import { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { C, db } from '../firebase';
import { storage } from '../storage';
import { useAuth } from '../auth';
import { LIB_CATS } from '../lib/constants';
import { errMsg, shortDate, todayKey, useLive } from '../lib/utils';
import { Icon, ICONS, Loading, Modal } from '../components/ui';

const KIND_ICON = { PDF: ICONS.pdf, Video: ICONS.video, Link: ICONS.link, Imagen: ICONS.image, Archivo: ICONS.pdf };

const kindOf = (file) => {
  if (!file) return 'Link';
  if (file.type === 'application/pdf') return 'PDF';
  if (file.type.startsWith('image/')) return 'Imagen';
  if (file.type.startsWith('video/')) return 'Video';
  return 'Archivo';
};

export default function Biblioteca() {
  const { staff } = useAuth();
  const canEdit = staff;
  const items = useLive(() => collection(db, C.library), []);
  const [cat, setCat] = useState('Todo');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const list = useMemo(() => (items.data || [])
    .filter((it) => cat === 'Todo' || it.cat === cat)
    .filter((it) => !q || `${it.title} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [items.data, cat, q]);

  const remove = async (it) => {
    if (!window.confirm(`¿Borrar “${it.title}”?`)) return;
    if (it.path) { try { await deleteObject(ref(storage, it.path)); } catch (e) { console.warn(e); } }
    await deleteDoc(doc(db, C.library, it.id));
  };

  return (
    <main className="page narrow">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <h1 className="d h1">Biblioteca</h1>
        {canEdit && <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => setOpen(true)}>Subir teórico</button>}
      </div>

      <div className="row between">
        <div className="chips" role="tablist" aria-label="Categorías">
          {['Todo', ...LIB_CATS].map((c) => (
            <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <label className="row panel" style={{ padding: '0 14px', flex: '0 1 280px', flexWrap: 'nowrap', gap: 10 }}>
          <span className="muted"><Icon d={ICONS.search} size={18} /></span>
          <input type="search" aria-label="Buscar" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 0, minHeight: 44, background: 'transparent', border: 0, outline: 'none' }} />
        </label>
      </div>

      <div>
        {items.loading && <Loading />}
        {!items.loading && list.length === 0 && <p className="empty">No hay material en esta categoría.</p>}
        {list.map((it) => (
          <div key={it.id} className="list-row">
            <span style={{ width: 44, height: 44, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface)' }}><Icon d={KIND_ICON[it.kind] || ICONS.link} /></span>
            <a href={it.url} target="_blank" rel="noreferrer" className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 18 }}>{it.title}</span>
              <span className="muted small">{it.cat} · {it.kind}{it.tags?.length ? ` · ${it.tags.join(', ')}` : ''}</span>
            </a>
            <span className="lbl muted" style={{ fontSize: 11 }}>{shortDate(it.date)}</span>
            {canEdit && <button className="icon-btn" onClick={() => remove(it)} aria-label={`Borrar ${it.title}`}><Icon d={ICONS.trash} size={18} /></button>}
          </div>
        ))}
      </div>

      {open && <UploadModal onClose={() => setOpen(false)} />}
    </main>
  );
}

function UploadModal({ onClose }) {
  const [f, setF] = useState({ title: '', cat: LIB_CATS[0], url: '', tags: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!file && !f.url.trim()) { setError('Subí un archivo o pegá un link.'); return; }
    setBusy(true);
    setError('');
    try {
      let url = f.url.trim();
      let path = '';
      if (file) {
        path = `sot/library/${Date.now()}_${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file);
        url = await getDownloadURL(r);
      }
      const isVideoLink = !file && /youtu|medal|twitch|vimeo/i.test(url);
      await addDoc(collection(db, C.library), {
        title: f.title.trim() || file?.name || url,
        cat: f.cat,
        kind: file ? kindOf(file) : (isVideoLink ? 'Video' : 'Link'),
        url,
        path,
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
        date: todayKey(),
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Subir teórico" onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        <label className="field"><span>Título</span><input className="input" value={f.title} onChange={set('title')} required /></label>
        <label className="field"><span>Categoría</span><select className="select" value={f.cat} onChange={set('cat')}>{LIB_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span>Archivo (PDF, imagen…)</span><input className="input" type="file" style={{ paddingTop: 12 }} onChange={(e) => setFile(e.target.files[0] || null)} /></label>
        <label className="field"><span>O un link (YouTube, Drive, Medal…)</span><input className="input" value={f.url} onChange={set('url')} disabled={!!file} /></label>
        <label className="field"><span>Etiquetas (separadas por coma)</span><input className="input" value={f.tags} onChange={set('tags')} placeholder="Ascent, retake" /></label>
        <p className="muted small" style={{ margin: 0 }}>Para videos conviene un link de YouTube no listado en vez de subir el archivo.</p>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Subiendo…' : 'Guardar'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}

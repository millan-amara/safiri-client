import { useState, useRef } from 'react';
import api from '../../utils/api';
import { cldThumb } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Image, Upload, Trash2, Star, X, GripVertical, Plus } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

export default function ImageGallery({ entityType, entityId, images = [], onUpdated, compact = false }) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);

    let successCount = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId);
        formData.append('caption', caption || file.name.replace(/\.[^.]+$/, ''));
        formData.append('isHero', images.length === 0 ? 'true' : 'false');

        await api.post('/uploads/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        successCount++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded`);
      onUpdated?.();
    }
    setUploading(false);
    setShowUpload(false);
    setCaption('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (imageUrl) => {
    try {
      await api.delete('/uploads/image', {
        data: { entityType, entityId, imageUrl },
      });
      toast.success('Image removed');
      setConfirmDelete(null);
      onUpdated?.();
    } catch {
      toast.error('Delete failed');
    }
  };

  const setHero = async (imageUrl) => {
    try {
      const updatedImages = images.map(img => ({
        ...img,
        isHero: img.url === imageUrl,
      }));

      // Destinations live under a different route than partner entities
      if (entityType === 'destination') {
        await api.put(`/destinations/${entityId}`, { images: updatedImages });
      } else {
        const endpoint = entityType === 'hotel' ? 'hotels' : entityType === 'activity' ? 'activities' : 'transport';
        await api.put(`/partners/${endpoint}/${entityId}`, { images: updatedImages });
      }

      toast.success('Hero image set');
      onUpdated?.();
    } catch {
      toast.error('Update failed');
    }
  };

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Image className="w-3 h-3" /> Images ({images.length})
          </label>
          <input type="file" ref={fileRef} onChange={handleUpload} accept="image/*" multiple className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !entityId}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5 disabled:opacity-40"
          >
            <Upload className="w-3 h-3" /> {uploading ? 'Uploading...' : 'Add'}
          </button>
        </div>
        {images.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={cldThumb(img.url, 150)}
                  alt={img.caption || ''}
                  loading="lazy"
                  decoding="async"
                  className={`w-14 h-14 object-cover rounded-md cursor-pointer ${img.isHero ? 'ring-2 ring-primary' : 'border border-border'}`}
                  onClick={() => setViewImage(img)}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(img.url); }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {!entityId && <p className="text-[10px] text-muted-foreground/70">Save first to add images</p>}

        {/* Lightbox */}
        {viewImage && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
            <div className="relative w-full max-w-2xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <img src={cldThumb(viewImage.url, 1600)} alt={viewImage.caption} decoding="async" className="max-w-full max-h-[80vh] mx-auto object-contain rounded-lg" />
              <button onClick={() => setViewImage(null)} className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                <X className="w-4 h-4" />
              </button>
              {viewImage.caption && <p className="text-white text-sm text-center mt-2">{viewImage.caption}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full gallery view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5 text-muted-foreground/70" /> Images ({images.length})
        </h4>
        <button
          type="button"
          onClick={() => setShowUpload(!showUpload)}
          disabled={!entityId}
          className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Upload
        </button>
      </div>

      {showUpload && (
        <div className="p-3 rounded-lg bg-background border border-border space-y-2 animate-scale-in">
          <input type="file" ref={fileRef} onChange={handleUpload} accept="image/*" multiple className="hidden" />
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-card border border-border text-xs focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50 shrink-0"
            >
              {uploading ? 'Uploading...' : 'Choose Files'}
            </button>
          </div>
        </div>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
              <img src={cldThumb(img.url, 300)} alt={img.caption || ''} loading="lazy" decoding="async" className="w-full h-24 object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                <button
                  type="button"
                  onClick={() => setHero(img.url)}
                  className={`p-1.5 rounded-md ${img.isHero ? 'bg-primary text-white' : 'bg-card/90 text-muted-foreground hover:bg-card'}`}
                  title={img.isHero ? 'Hero image' : 'Set as hero'}
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(img.url)}
                  className="p-1.5 rounded-md bg-card/90 text-red-500 hover:bg-card"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {img.isHero && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-primary text-white text-[8px] font-bold uppercase">Hero</div>
              )}
              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[9px] text-white truncate">{img.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center border border-dashed border-border rounded-lg">
          <Image className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground/70">{entityId ? 'No images yet' : 'Save first to add images'}</p>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove this image?"
          message="The image will be permanently deleted from the gallery."
          confirmLabel="Remove"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
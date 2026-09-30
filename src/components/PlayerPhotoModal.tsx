import React, { useState, useRef } from 'react';
import { Camera, Upload, Link, Check, X, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PLAYER_AVATAR_PRESETS, processPlayerImageFile } from '../utils/playerAvatars';
import { soundFx } from '../utils/audio';

interface PlayerPhotoModalProps {
  isOpen: boolean;
  currentPhotoUrl?: string;
  playerName: string;
  position: string;
  shirtNumber: number;
  onSavePhoto: (newPhotoUrl: string | undefined) => void;
  onClose: () => void;
}

export const PlayerPhotoModal: React.FC<PlayerPhotoModalProps> = ({
  isOpen,
  currentPhotoUrl,
  playerName,
  position,
  shirtNumber,
  onSavePhoto,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentPhotoUrl);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const dataUrl = await processPlayerImageFile(file);
      setPreviewUrl(dataUrl);
      soundFx.playClick();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setPreviewUrl(urlInput.trim());
    setErrorMessage(null);
    soundFx.playClick();
  };

  const handleSelectPreset = (url: string) => {
    setPreviewUrl(url);
    setErrorMessage(null);
    soundFx.playClick();
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(undefined);
    setUrlInput('');
    setErrorMessage(null);
    soundFx.playClick();
  };

  const handleSave = () => {
    soundFx.playClick();
    onSavePhoto(previewUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Foto & Visual do Jogador
              </h3>
              <p className="text-xs text-neutral-400">
                Personalize a foto oficial de {playerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="flex items-center gap-5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-neutral-800 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shrink-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={playerName}
                className="w-full h-full object-cover"
                onError={() => {
                  setErrorMessage('Não foi possível carregar a imagem deste link.');
                  setPreviewUrl(undefined);
                }}
              />
            ) : (
              <div className="text-3xl font-black text-neutral-500">⚽</div>
            )}
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-neutral-900/90 text-emerald-400 border border-emerald-500/30 font-mono">
              #{shirtNumber}
            </span>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Pré-visualização Oficial
            </span>
            <h4 className="text-sm font-extrabold text-white truncate font-heading">{playerName}</h4>
            <p className="text-xs text-neutral-400">Posição: {position}</p>
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold pt-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover foto
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => { soundFx.playClick(); setActiveTab('upload'); }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'upload' ? 'bg-emerald-500 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Do Dispositivo
          </button>
          <button
            type="button"
            onClick={() => { soundFx.playClick(); setActiveTab('presets'); }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'presets' ? 'bg-emerald-500 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Avatares Prontos
          </button>
          <button
            type="button"
            onClick={() => { soundFx.playClick(); setActiveTab('url'); }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'url' ? 'bg-emerald-500 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Link Web
          </button>
        </div>

        {/* Tab 1: Upload from device */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-emerald-500/60 bg-neutral-950/60 hover:bg-neutral-950 transition cursor-pointer text-center space-y-2 group"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800 group-hover:bg-emerald-500/20 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 transition">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-neutral-200">
                {isProcessing ? 'Processando imagem...' : 'Clique para selecionar foto do seu dispositivo'}
              </p>
              <p className="text-[11px] text-neutral-500">
                PNG, JPG, WEBP • Otimizado automaticamente
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Curated Presets */}
        {activeTab === 'presets' && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PLAYER_AVATAR_PRESETS.map((preset) => {
                const isSelected = previewUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-2 relative ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-neutral-700 shadow shrink-0">
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-neutral-300 leading-tight line-clamp-2">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center text-[10px] font-black">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: URL Link */}
        {activeTab === 'url' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">
                Cole a URL direta da imagem (JPG/PNG/WebP):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://exemplo.com/minha-foto.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition"
                >
                  Testar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Salvar Foto do Atleta
          </button>
        </div>
      </div>
    </div>
  );
};

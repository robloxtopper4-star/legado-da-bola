export interface PlayerAvatarPreset {
  id: string;
  name: string;
  url: string;
  description: string;
}

// Curated high quality stylized player headshots/avatars
export const PLAYER_AVATAR_PRESETS: PlayerAvatarPreset[] = [
  {
    id: 'preset_brazil_star',
    name: 'Jovem Promessa Sul-Americana',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    description: 'Corte moderno, olhar focado e espírito de drible.'
  },
  {
    id: 'preset_striker_classic',
    name: 'Camisa 9 Raçudo',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    description: 'Fisionomia de centroavante clássico, presença de área.'
  },
  {
    id: 'preset_playmaker',
    name: 'Meia Maestro / Camisa 10',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    description: 'Visão refinada, liderança e técnica pura.'
  },
  {
    id: 'preset_prodigy_euro',
    name: 'Joia das Categorias de Base',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
    description: 'Estilo dinâmico, veloz e moderno.'
  },
  {
    id: 'preset_defender_warrior',
    name: 'Zagueiro Xerife',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    description: 'Imponência física, concentração e garra defensiva.'
  },
  {
    id: 'preset_goalkeeper_wall',
    name: 'Goleiro Paredão',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
    description: 'Frieza sob pressão e envergadura.'
  },
  {
    id: 'preset_winger_flair',
    name: 'Ponta Habilidoso',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
    description: 'Aceleração explosiva e ousadia no um contra um.'
  },
  {
    id: 'preset_afro_star',
    name: 'Craque Atlético',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
    description: 'Talento nato, potência física e carisma com a torcida.'
  }
];

/**
 * Resizes and compresses an uploaded image file into a compact base64 JPEG
 * suitable for localStorage.
 */
export async function processPlayerImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check type
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;

        // Scale proportionally to square crop or fit
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with 80% quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao decodificar a imagem enviada.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo no dispositivo.'));
    reader.readAsDataURL(file);
  });
}

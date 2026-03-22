'use strict';

const SONG_LIBRARY = [
  { id: 'sayyes', name: 'Say Yes To Heaven', src: 'assets/music/sayyes.mp3' },
  { id: 'neonmoon', name: 'Neon Moon', src: 'assets/music/Neon moon.mp3' },
  { id: 'cold', name: 'COLD', src: 'assets/music/COLD.mp3' },
  { id: 'loverrock', name: 'loverrock', src: 'assets/music/loverrock.mp3' },
  { id: 'Awakening - NCS', name: 'Awakening - NCS', src: 'assets/music/Awakening - NCS.mp3' },
  { id: 'Mr. Blue Sky', name: 'Mr. Blue Sky', src: 'assets/music/Mr. Blue Sky.mp3' }
];

class MetroMusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.preload = 'none';
    this.audio.volume = 0.45;

    this.currentSong = SONG_LIBRARY[0];
    this.isPlaying = false;

    this.button = document.getElementById('music-toggle');
    this.select = document.getElementById('music-select');
    this.status = document.getElementById('music-status');
    this.card = document.getElementById('music-player');

    this.populateSongs();
    this.syncAudioSource();
    this.bindEvents();
    this.updateUI();
  }

  populateSongs() {
    this.select.innerHTML = SONG_LIBRARY.map(song => (
      `<option value="${song.id}">${song.name}</option>`
    )).join('');
    this.select.value = this.currentSong.id;
  }

  bindEvents() {
    this.button.addEventListener('click', async () => {
      await this.togglePlayback();
    });

    this.select.addEventListener('change', async event => {
      const selectedSong = SONG_LIBRARY.find(song => song.id === event.target.value);
      if (!selectedSong) return;

      this.currentSong = selectedSong;
      this.syncAudioSource();
      this.updateUI();

      if (this.isPlaying) {
        await this.playCurrentSong();
      }
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.updateUI();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updateUI();
    });

    this.audio.addEventListener('error', () => {
      this.isPlaying = false;
      this.updateUI('MISSING FILE · UPDATE music.js SRC PATHS');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying) {
        this.audio.pause();
      }
    });
  }

  syncAudioSource() {
    this.audio.src = this.currentSong.src;
    this.audio.load();
  }

  async togglePlayback() {
    if (this.isPlaying) {
      this.audio.pause();
      return;
    }

    await this.playCurrentSong();
  }

  async playCurrentSong() {
    try {
      await this.audio.play();
    } catch (error) {
      this.isPlaying = false;
      this.updateUI('MISSING FILE · UPDATE music.js SRC PATHS');
    }
  }

  updateUI(customStatus) {
    this.button.textContent = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
    this.button.setAttribute('aria-pressed', String(this.isPlaying));

    if (customStatus) {
      this.status.textContent = customStatus;
    } else {
      this.status.textContent = this.isPlaying
        ? `NOW PLAYING · ${this.currentSong.name}`
        : `READY · ${this.currentSong.name}`;
    }

    this.card.classList.toggle('playing', this.isPlaying);
  }
}

export function initMusicPlayer() {
  return new MetroMusicPlayer();
}
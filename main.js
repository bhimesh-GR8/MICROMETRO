'use strict';

import { initGame } from './game.js';
import { initMusicPlayer } from './music.js';
window.addEventListener('DOMContentLoaded', () => {
  initGame();
  initMusicPlayer();
});

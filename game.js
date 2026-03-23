'use strict';

import {
  DIFFICULTY_MODES,
  LINE_COLORS,
  MAX_POSSIBLE_LINES,
  PASSENGER_SHAPES,
  STATION_RADIUS,
  STATION_SPAWN_INTERVAL,
  MIN_STATION_DISTANCE,
  MAX_STATIONS,
  INITIAL_STATIONS,
  INSERT_DETECTION_RADIUS
} from './constants.js';

import {
  findBestInsertSegment,
  pointToSegmentDistance,
  lerp,
  drawRoundedRect
} from './utils.js';

import {
  Station,
  Train,
  Line,
  Passenger
} from './entities.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.currentDifficulty = DIFFICULTY_MODES.normal;
    this.theme = 'dark';

    this.stations = [];
    this.lines = [];
    this.maxLines = 3;
    this.selectedStation = null;
    this.activeLineIndex = -1;

    this.score = 0;
    this.totalSpent = 0;
    this.isRunning = false;

    this.floatingTexts = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.passSpawnTimer = 0;
    this.stationSpawnTimer = 0;
    this.lastFrameTime = 0;
    this.insertPreview = null;
    this.isHTPDrawerOpen = false;

    this.setupEventListeners();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame(ts => this.gameLoop(ts));
    this.showMainMenu();
  }

  get isDarkTheme() {
    return this.theme === 'dark';
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    this.canvas.addEventListener('click', e => this.onCanvasClick(e));
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));

    document.getElementById('buy-line-btn').addEventListener('click', () => this.purchaseLine());
    document.getElementById('buy-train-btn').addEventListener('click', () => this.purchaseTrain());
    document.getElementById('theme-btn').addEventListener('click', () => this.toggleTheme());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('menu-btn').addEventListener('click', () => this.returnToMenuSafely());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('restart-btn').addEventListener('click', () => this.startGame(this.currentDifficulty));
    document.getElementById('pause-menu-btn').addEventListener('click', () => this.showMainMenu());
    document.getElementById('htp-game-btn').addEventListener('click', () => this.toggleHTPDrawer());

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this.isRunning && this.selectedStation) {
          this.selectedStation = null;
          this.activeLineIndex = -1;
          this.insertPreview = null;
          document.getElementById('insert-badge').classList.remove('show');
          this.updatePanel();
        } else if (this.isRunning) {
          this.togglePause();
        }
      }
      if (e.key.toLowerCase() === 'p' && this.isRunning) {
        this.togglePause();
      }
    });
  }

  toggleTheme() {
    this.theme = this.isDarkTheme ? 'light' : 'dark';
    document.body.classList.toggle('light', !this.isDarkTheme);
    const themeBtn = document.getElementById('theme-btn');
    document.getElementById('theme-icon').textContent = this.isDarkTheme ? '☀' : '☾';
    themeBtn.querySelector('span:last-child').textContent = this.isDarkTheme ? 'LIGHT' : 'DARK';
  }

  togglePause() {
    if (!this.isRunning) return;

    this.isPaused = !this.isPaused;
    const pauseOverlay = document.getElementById('pause-overlay');

    if (this.isPaused) {
      pauseOverlay.classList.add('vis');
      if (this.isHTPDrawerOpen) this.toggleHTPDrawer();
    } else {
      pauseOverlay.classList.remove('vis');
    }

    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.querySelector('span:first-child').textContent = this.isPaused ? '▶' : '⏸';
    pauseBtn.querySelector('span:last-child').textContent = this.isPaused ? 'RESUME' : 'PAUSE';
  }

  returnToMenuSafely() {
    if (this.isRunning && !this.isPaused) this.togglePause();
    this.showMainMenu();
  }

  toggleHTPDrawer() {
    this.isHTPDrawerOpen = !this.isHTPDrawerOpen;
    document.getElementById('htp-drawer').classList.toggle('open', this.isHTPDrawerOpen);
    const btn = document.getElementById('htp-game-btn');
    btn.textContent = this.isHTPDrawerOpen ? '✕ CLOSE' : '? HOW TO PLAY';
  }

  showMainMenu() {
    this.isPaused = false;
    this.isRunning = false;
    document.getElementById('pause-overlay').classList.remove('vis');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('panel').classList.add('hidden');
    if (this.isHTPDrawerOpen) this.toggleHTPDrawer();

    let selectedDifficulty = 'normal';
    let htpExpanded = false;

    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.classList.remove('fade-out');
    overlay.classList.add('vis');

    const renderMenu = () => {
      overlay.innerHTML = `
        <div class="ov-logo">MICROMETRO</div>
        <div class="ov-tag">DRAW LINES · BUY TRAINS · SURVIVE</div>

        <div class="theme-row">
          <button class="theme-pill${this.isDarkTheme ? ' on' : ''}" id="m-dark">☾ DARK</button>
          <button class="theme-pill${!this.isDarkTheme ? ' on' : ''}" id="m-light">☀ LIGHT</button>
        </div>

        <div class="diff-row">
          ${['easy', 'normal', 'hard'].map(key => {
            const cfg = DIFFICULTY_MODES[key];
            return `
              <div class="diff-card ${key}${selectedDifficulty === key ? ' sel' : ''}" data-k="${key}">
                <div class="dlabel">${cfg.label}</div>
                <div class="dstat">
                  <div class="drow"><span>MAX PASSENGERS</span><b>${cfg.maxPassengers}</b></div>
                  <div class="drow"><span>OVERCROWD TIME</span><b>${cfg.overcrowdLimit}s</b></div>
                  <div class="drow"><span>STARTING LINES</span><b>${cfg.startingLines}</b></div>
                  <div class="drow"><span>PTS / DELIVERY</span><b>${cfg.scorePerDelivery}</b></div>
                  <div class="drow"><span>NEW LINE COST</span><b>${cfg.newLineCost}</b></div>
                  <div class="drow"><span>ADD TRAIN COST</span><b>${cfg.newTrainCost}</b></div>
                </div>
              </div>`;
          }).join('')}
        </div>

        <button class="htp-acc-btn" id="htp-acc">▸ HOW TO PLAY</button>
        <div class="htp-acc-box${htpExpanded ? ' open' : ''}" id="htp-acc-box">
          <div class="htp-acc-grid">
            ${[
              ['🖱', 'DRAW A LINE', 'Click any station, then click another. A coloured line and train appear automatically.'],
              ['➕', 'EXTEND A LINE', 'Click an endpoint station (start or end of a line), then click a new station.'],
              ['⊕', 'INSERT A STOP', 'Hover near existing tracks — a gold glow appears. Click to insert the station into that line.'],
              ['🎨', 'TARGET A LINE', 'Click a coloured swatch in the bottom bar to lock onto that specific line.'],
              ['🚂', 'ADD A TRAIN', 'Select a line swatch, then click ADD TRAIN. Trains stagger so they spread out.'],
              ['💰', 'BUY LINE SLOTS', 'Spend points to unlock more line slots. Cost goes up with each purchase.'],
              ['⚠', 'DANGER ARC', 'A red arc fills when a station is full. Complete arc = Game Over.'],
              ['🔵', 'PASSENGERS', 'Tiny shapes above stations show where passengers want to go. Match the station shape.']
            ].map(([icon, title, desc]) => `
              <div class="htp-acc-item">
                <div class="htp-acc-icon">${icon}</div>
                <div class="htp-acc-txt"><b>${title}</b>${desc}</div>
              </div>`).join('')}
          </div>
        </div>

        <button class="ov-btn" id="ov-go" style="margin-top:16px">START GAME</button>`;

      overlay.querySelectorAll('.diff-card').forEach(card => {
        card.addEventListener('click', () => {
          selectedDifficulty = card.dataset.k;
          renderMenu();
        });
      });

      document.getElementById('ov-go').addEventListener('click', () => this.startGame(DIFFICULTY_MODES[selectedDifficulty]));
      document.getElementById('htp-acc').addEventListener('click', () => {
        htpExpanded = !htpExpanded;
        renderMenu();
      });

      document.getElementById('m-dark').addEventListener('click', () => {
        if (!this.isDarkTheme) { this.toggleTheme(); renderMenu(); }
      });
      document.getElementById('m-light').addEventListener('click', () => {
        if (this.isDarkTheme) { this.toggleTheme(); renderMenu(); }
      });
    };

    renderMenu();
  }

  showGameOverScreen() {
    this.isRunning = false;
    this.isPaused = false;
    document.getElementById('pause-overlay').classList.remove('vis');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('panel').classList.add('hidden');
    if (this.isHTPDrawerOpen) this.toggleHTPDrawer();

    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.classList.remove('fade-out');
    overlay.classList.add('vis');
    const finalScore = Math.round(this.score + (this.totalSpent * 0.8));
    overlay.innerHTML = `
      <div class="go-title">GAME OVER LOL</div>
      <div class="go-reason">A STATION WAS OVERWHELMED BY WAITING PASSENGERS BECAUSE U DIDNT CATE ANOUT THEM</div>
      <div class="go-score">${finalScore}</div>
      <div class="go-sub">FINAL SCORE  ·  ${this.currentDifficulty.label} MODE</div>
      <div class="go-btns">
        <button class="ov-btn" id="go-retry">↺ LETS PLAY AGAIN!</button>
        <button class="ov-btn dim" id="go-menu">⌂ BACK TO MENU</button>
      </div>`;

    document.getElementById('go-retry').addEventListener('click', () => this.startGame(this.currentDifficulty));
    document.getElementById('go-menu').addEventListener('click', () => this.showMainMenu());
  }

  startGame(difficultyConfig) {
    this.currentDifficulty = difficultyConfig;
    this.stations = [];
    this.lines = [];
    this.maxLines = difficultyConfig.startingLines;
    this.selectedStation = null;
    this.activeLineIndex = -1;
    this.score = 0;
    this.totalSpent = 0;
    this.floatingTexts = [];
    this.stationSpawnTimer = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.insertPreview = null;

    document.getElementById('pause-overlay').classList.remove('vis');
    if (this.isHTPDrawerOpen) this.toggleHTPDrawer();

    document.getElementById('pause-btn').querySelector('span:first-child').textContent = '⏸';
    document.getElementById('pause-btn').querySelector('span:last-child').textContent = 'PAUSE';

    const overlay = document.getElementById('overlay');
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('vis', 'fade-out');
    }, 400);

    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('panel').classList.remove('hidden');

    const diffBadge = document.getElementById('hd');
    diffBadge.textContent = difficultyConfig.label;
    diffBadge.className = `hdiff ${difficultyConfig.key}`;

    this.updateHUD();
    this.updatePanel();

    for (let i = 0; i < INITIAL_STATIONS; i++) {
      this.spawnStation();
    }
  }

  isPointInUI(x, y) {
    const uiIds = ['hud', 'panel'];
    const padding = STATION_RADIUS + 8;

    return uiIds.some(id => {
      const el = document.getElementById(id);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;

      // Canvas covers viewport; client coordinates match canvas coordinates.
      return (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
      );
    });
  }

  spawnStation() {
    if (this.stations.length >= MAX_STATIONS) return;

    const margin = 90;
    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let attempt = 0; attempt < 160; attempt++) {
      const x = margin + Math.random() * (width - margin * 2);
      const y = margin + Math.random() * (height - margin * 2);

      if (this.isPointInUI(x, y)) continue;

      const tooClose = this.stations.some(stn => Math.hypot(stn.x - x, stn.y - y) < MIN_STATION_DISTANCE);
      if (!tooClose) {
        const randomShape = PASSENGER_SHAPES[Math.floor(Math.random() * 3)];
        this.stations.push(new Station(x, y, randomShape));
        return;
      }
    }
  }

  spawnPassenger() {
    if (this.stations.length < 2) return;

    const shuffledStations = [...this.stations].sort(() => Math.random() - 0.5);
    const availableStation = shuffledStations.find(stn => stn.passengers.length < this.currentDifficulty.maxPassengers);

    if (!availableStation) return;

    const otherShapes = PASSENGER_SHAPES.filter(shape => shape !== availableStation.shape);
    const randomDestination = otherShapes[Math.floor(Math.random() * otherShapes.length)];
    availableStation.passengers.push(new Passenger(randomDestination));
  }

  purchaseLine() {
    if (!this.isRunning || this.isPaused) return;

    if (this.maxLines >= MAX_POSSIBLE_LINES) {
      this.showFlashMessage('MAXIMUM LINES REACHED');
      return;
    }

    const cost = this.getLinePurchaseCost();
    if (this.score < cost) {
      this.showFlashMessage(`NEED ${cost} PTS — BUY LINE`);
      return;
    }

    this.score -= cost;
    this.totalSpent += cost;
    this.maxLines++;
    this.updatePanel();
    this.updateHUD
    this.showFlashMessage(`NEW LINE SLOT UNLOCKED  ·  ${this.maxLines} TOTAL`);
  }

  purchaseTrain() {
    if (!this.isRunning || this.isPaused) return;

    if (this.activeLineIndex < 0) {
      this.showFlashMessage('SELECT A LINE FIRST — CLICK A COLOURED SWATCH');
      return;
    }

    const line = this.lines[this.activeLineIndex];
    if (!line) {
      this.showFlashMessage('NO LINE ON THAT SLOT YET');
      return;
    }

    if (line.stations.length < 2) {
      this.showFlashMessage('LINE NEEDS AT LEAST 2 STATIONS');
      return;
    }

    if (line.trains.length >= this.currentDifficulty.maxTrainsPerLine) {
      this.showFlashMessage(`MAX ${this.currentDifficulty.maxTrainsPerLine} TRAINS PER LINE`);
      return;
    }

    const cost = this.getTrainPurchaseCost(line);
    if (this.score < cost) {
      this.showFlashMessage(`NEED ${cost} PTS — ADD TRAIN`);
      return;
    }

    this.score -= cost;
    this.totalSpent += cost;
    line.addTrain();
    this.updatePanel();
    this.updateHUD
    this.showFlashMessage(`TRAIN ADDED  ·  ${line.trains.length} TRAINS ON LINE ${this.activeLineIndex + 1}`);
  }

  getLinePurchaseCost() {
    return this.currentDifficulty.newLineCost * (this.maxLines - this.currentDifficulty.startingLines + 1);
  }

  getTrainPurchaseCost(line) {
    return this.currentDifficulty.newTrainCost * line.trains.length;
  }

  updatePanel() {
    const container = document.getElementById('swatches');
    container.innerHTML = '';

    for (let i = 0; i < this.maxLines; i++) {
      const line = this.lines[i];

      if (line) {
        const element = document.createElement('div');
        element.className = 'swatch' + (this.activeLineIndex === i ? ' active' : '');
        element.style.background = line.color;
        element.style.setProperty('--sc', line.color);

        const stopsLabel = document.createElement('span');
        stopsLabel.className = 'sb-stops';
        stopsLabel.textContent = line.stations.length;

        const trainsLabel = document.createElement('span');
        trainsLabel.className = 'sb-trains';
        trainsLabel.innerHTML = `🚂${line.trains.length}`;
        trainsLabel.style.color = line.color;

        element.appendChild(stopsLabel);
        element.appendChild(trainsLabel);
        element.title = `Line ${i + 1}  ·  ${line.stations.length} stops  ·  ${line.trains.length} train(s)`;
        element.addEventListener('click', () => this.selectLine(i));
        container.appendChild(element);
      } else {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'swatch-empty';
        emptySlot.innerHTML = '＋';
        container.appendChild(emptySlot);
      }
    }

    const maxedOut = this.maxLines >= MAX_POSSIBLE_LINES;
    document.getElementById('buy-line-btn').disabled = maxedOut;
    document.getElementById('line-cost-val').textContent = maxedOut ? 'MAXED' : `${this.getLinePurchaseCost()} PTS`;

    const activeLine = this.lines[this.activeLineIndex];
    const trainsFull = activeLine && activeLine.trains.length >= this.currentDifficulty.maxTrainsPerLine;
    const hasActiveLine = this.activeLineIndex >= 0 && !!activeLine;

    const trainBtn = document.getElementById('buy-train-btn');
    trainBtn.disabled = !hasActiveLine || trainsFull;
    trainBtn.classList.toggle('ready', hasActiveLine && !trainsFull);
    document.getElementById('train-cost-val').textContent = !hasActiveLine ? '— PTS' : trainsFull ? 'FULL' : `${this.getTrainPurchaseCost(activeLine)} PTS`;
  }

  selectLine(lineIndex) {
    this.activeLineIndex = (this.activeLineIndex === lineIndex) ? -1 : lineIndex;
    this.updatePanel();

    if (this.activeLineIndex >= 0) {
      const line = this.lines[lineIndex];
      const trainsFull = line && line.trains.length >= this.currentDifficulty.maxTrainsPerLine;
      this.showFlashMessage(
        trainsFull
          ? `LINE ${lineIndex + 1}  ·  TRAINS FULL`
          : `LINE ${lineIndex + 1}  ·  ADD TRAIN FOR ${line ? this.getTrainPurchaseCost(line) : 0} PTS`
      );
    }
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    if (this.isRunning && !this.isPaused) {
      this.updateInsertPreview();
    }
  }

  updateInsertPreview() {
    const badge = document.getElementById('insert-badge');

    if (!this.selectedStation || !this.lines.length) {
      this.insertPreview = null;
      badge.classList.remove('show');
      return;
    }

    const linesToCheck = this.activeLineIndex >= 0 && this.lines[this.activeLineIndex]
      ? [this.lines[this.activeLineIndex], ...this.lines.filter((_, i) => i !== this.activeLineIndex)]
      : this.lines;

    for (const line of linesToCheck) {
      if (line.stations.length < 2) continue;

      const { segmentIndex, distance } = findBestInsertSegment(line, this.mouseX, this.mouseY);

      if (distance < INSERT_DETECTION_RADIUS && !line.hasStation(this.selectedStation)) {
        this.insertPreview = { line, segmentIndex };
        badge.classList.add('show');
        return;
      }
    }

    this.insertPreview = null;
    badge.classList.remove('show');
  }

  onCanvasClick(event) {
    if (!this.isRunning || this.isPaused) return;

    const rect = this.canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const hitStation = this.stations.find(stn => Math.hypot(stn.x - clickX, stn.y - clickY) < STATION_RADIUS + 14);

    if (!hitStation) {
      this.selectedStation = null;
      this.activeLineIndex = -1;
      this.insertPreview = null;
      document.getElementById('insert-badge').classList.remove('show');
      this.updatePanel();
      return;
    }

    if (!this.selectedStation) {
      this.selectedStation = hitStation;
      return;
    }

    if (this.selectedStation === hitStation) {
      this.selectedStation = null;
      this.insertPreview = null;
      return;
    }

    this.connectStations(this.selectedStation, hitStation);
    this.selectedStation = null;
    this.insertPreview = null;
    document.getElementById('insert-badge').classList.remove('show');
  }

  connectStations(fromStation, toStation) {
    const tryExtendLine = (line, stationA, stationB) => {
      if (line.hasStation(stationA) && line.hasStation(stationB)) return false;
      if (!line.hasStation(stationB) && line.isTailEnd(stationA)) {
        line.addStation(stationB);
        return true;
      }
      if (!line.hasStation(stationB) && line.isHeadEnd(stationA)) {
        line.prependStation(stationB);
        return true;
      }
      return false;
    };

    if (this.insertPreview) {
      const { line, segmentIndex } = this.insertPreview;
      if (!line.hasStation(toStation)) {
        line.insertAfter(segmentIndex, toStation);
        this.showFlashMessage(`STOP INSERTED INTO LINE ${this.lines.indexOf(line) + 1}`);
        this.updateHUD();
        this.updatePanel();
        return;
      }
    }

    if (this.activeLineIndex >= 0) {
      const line = this.lines[this.activeLineIndex];
      if (line) {
        if (tryExtendLine(line, fromStation, toStation) || tryExtendLine(line, toStation, fromStation)) {
          this.updateHUD();
          this.updatePanel();
          return;
        }
        this.showFlashMessage('CANNOT EXTEND THAT LINE  ·  AUTO-ROUTING');
        this.activeLineIndex = -1;
        this.updatePanel();
      }
    }

    for (const line of this.lines) {
      if (tryExtendLine(line, fromStation, toStation)) {
        this.updateHUD();
        this.updatePanel();
        return;
      }
    }

    for (const line of this.lines) {
      if (tryExtendLine(line, toStation, fromStation)) {
        this.updateHUD();
        this.updatePanel();
        return;
      }
    }

    for (const line of this.lines) {
      if (line.hasStation(fromStation) && !line.hasStation(toStation)) {
        const { segmentIndex, distance } = findBestInsertSegment(line, toStation.x, toStation.y);
        if (distance < INSERT_DETECTION_RADIUS * 2) {
          line.insertAfter(segmentIndex, toStation);
          this.showFlashMessage(`STOP INSERTED INTO LINE ${this.lines.indexOf(line) + 1}`);
          this.updateHUD();
          this.updatePanel();
          return;
        }
      }
    }

    for (const line of this.lines) {
      if (line.hasStation(toStation) && !line.hasStation(fromStation)) {
        const { segmentIndex, distance } = findBestInsertSegment(line, fromStation.x, fromStation.y);
        if (distance < INSERT_DETECTION_RADIUS * 2) {
          line.insertAfter(segmentIndex, fromStation);
          this.showFlashMessage(`STOP INSERTED INTO LINE ${this.lines.indexOf(line) + 1}`);
          this.updateHUD();
          this.updatePanel();
          return;
        }
      }
    }

    if (this.lines.some(line => line.hasStation(fromStation) && line.hasStation(toStation))) {
      this.showFlashMessage('ALREADY CONNECTED ON A LINE');
      return;
    }

    if (this.lines.length >= this.maxLines) {
      this.showFlashMessage(`ALL SLOTS USED  ·  BUY MORE FOR ${this.getLinePurchaseCost()} PTS`);
      return;
    }

    const newLine = new Line(LINE_COLORS[this.lines.length]);
    newLine.addStation(fromStation);
    newLine.addStation(toStation);
    this.lines.push(newLine);
    this.updateHUD();
    this.updatePanel();
  }

  onPassengerDelivered(station) {
    this.score += this.currentDifficulty.scorePerDelivery;
    this.floatingTexts.push({
      x: station.x,
      y: station.y - 10,
      timer: 1.1,
      maxTime: 1.1,
      value: this.currentDifficulty.scorePerDelivery
    });
    this.updateHUD();
    this.updatePanel();
  }

  updateHUD() {
    document.getElementById('hs').textContent = this.score;
    document.getElementById('hl').textContent = `${this.lines.length}/${this.maxLines}`;
  }

  showFlashMessage(message) {
    const element = document.getElementById('flash');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => element.classList.remove('show'), 2600);
  }

  update(deltaTime) {
    if (!this.isRunning || this.isPaused) return;

    this.stationSpawnTimer += deltaTime;
    if (this.stationSpawnTimer >= STATION_SPAWN_INTERVAL) {
      this.stationSpawnTimer = 0;
      this.spawnStation();
    }

    this.passSpawnTimer += deltaTime;
    if (this.passSpawnTimer >= this.currentDifficulty.passSpawnInterval) {
      this.passSpawnTimer = 0;
      this.spawnPassenger();
      if (Math.random() < 0.4) this.spawnPassenger();
    }

    this.stations.forEach(stn => stn.update(deltaTime, this.currentDifficulty.maxPassengers));
    this.lines.forEach(line => line.update(deltaTime));

    this.floatingTexts = this.floatingTexts.filter(f => f.timer > 0);
    this.floatingTexts.forEach(f => f.timer -= deltaTime);

    if (this.stations.some(stn => stn.overcrowdingTimer >= this.currentDifficulty.overcrowdLimit)) {
      this.showGameOverScreen();
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const isDark = this.isDarkTheme;

    ctx.fillStyle = isDark ? '#0d1117' : '#f0ece2';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.026)' : 'rgba(0, 0, 0, 0.048)';
    for (let gx = 48; gx < width; gx += 48) {
      for (let gy = 48; gy < height; gy += 48) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!this.isRunning) return;

    this.lines.forEach((line, index) => line.draw(ctx, isDark, index));

    if (this.insertPreview && this.selectedStation) {
      const { line, segmentIndex } = this.insertPreview;
      const stationA = line.stations[segmentIndex];
      const stationB = line.stations[segmentIndex + 1];

      if (stationB) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 230, 66, 0.75)';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(245, 230, 66, 0.55)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(stationA.x, stationA.y);
        ctx.lineTo(stationB.x, stationB.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.selectedStation) {
      let previewColor = this.insertPreview
        ? this.insertPreview.line.color
        : (LINE_COLORS[this.lines.length] || '#fff');

      if (this.activeLineIndex >= 0 && this.lines[this.activeLineIndex] && !this.insertPreview) {
        previewColor = this.lines[this.activeLineIndex].color;
      }

      ctx.save();
      ctx.setLineDash([7, 10]);
      ctx.strokeStyle = previewColor;
      ctx.globalAlpha = this.insertPreview ? 0.9 : 0.5;
      ctx.lineWidth = this.insertPreview ? 3.5 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.selectedStation.x, this.selectedStation.y);
      ctx.lineTo(this.mouseX, this.mouseY);
      ctx.stroke();
      ctx.restore();
    }

    this.stations.forEach(stn => stn.draw(ctx, stn === this.selectedStation, this.currentDifficulty.maxPassengers, this.currentDifficulty.overcrowdLimit, isDark));

    this.floatingTexts.forEach(floatingText => {
      const progress = floatingText.timer / floatingText.maxTime;
      ctx.globalAlpha = progress;
      ctx.fillStyle = isDark ? '#f5e642' : '#8a5e00';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`+${floatingText.value}`, floatingText.x, floatingText.y - (1 - progress) * 42);
    });
    ctx.globalAlpha = 1;

    const contextHint = this.selectedStation
      ? (this.insertPreview
        ? '⊕  CLICK TO INSERT INTO THE GLOWING LINE'
        : 'CLICK ANOTHER STATION TO CONNECT   ·   ESC TO CANCEL')
      : this.activeLineIndex >= 0
        ? `LINE ${this.activeLineIndex + 1} SELECTED   ·   CLICK STATION TO EXTEND   OR   CLICK ADD TRAIN BELOW`
        : 'CLICK ANY STATION TO DRAW A LINE   ·   SELECT A SWATCH BELOW TO EXTEND A SPECIFIC LINE';

    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'center';
    const hintWidth = ctx.measureText(contextHint).width + 32;
    const hintX = width / 2;
    const hintY = height - 80;

    drawRoundedRect(ctx, hintX - hintWidth / 2, hintY - 14, hintWidth, 22, 11);
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.75)';
    ctx.fill();
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.72)';
    ctx.fillText(contextHint, hintX, hintY);

    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  gameLoop(timestamp) {
    const deltaTime = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    this.update(deltaTime);
    this.draw();

    requestAnimationFrame(ts => this.gameLoop(ts));
  }
}

export function initGame() {
  const gameInstance = new Game();
  window.gameInstance = gameInstance;
}

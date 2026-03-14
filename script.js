'use strict';

/* ═══════════════════════════════════════════════════════════
   MICROMETRO - GAME LOGIC & RENDERING
   A subway simulation game by a human
═══════════════════════════════════════════════════════════ */

// Game configuration and constants
const DIFFICULTY_MODES = {
  easy: {
    key: 'easy',
    label: 'EASY',
    maxPassengers: 8,
    overcrowdLimit: 20,
    passSpawnInterval: 5.0,
    startingLines: 4,
    scorePerDelivery: 5,
    newLineCost: 80,
    newTrainCost: 50,
    maxTrainsPerLine: 4
  },
  normal: {
    key: 'normal',
    label: 'NORMAL',
    maxPassengers: 5,
    overcrowdLimit: 14,
    passSpawnInterval: 3.5,
    startingLines: 3,
    scorePerDelivery: 8,
    newLineCost: 150,
    newTrainCost: 80,
    maxTrainsPerLine: 3
  },
  hard: {
    key: 'hard',
    label: 'HARD',
    maxPassengers: 3,
    overcrowdLimit: 9,
    passSpawnInterval: 2.3,
    startingLines: 2,
    scorePerDelivery: 15,
    newLineCost: 220,
    newTrainCost: 130,
    maxTrainsPerLine: 3
  }
};

const LINE_COLORS = ['#FF4444', '#4d9ef7', '#2ecc71', '#FFBB33', '#b76aff', '#FF44CC', '#00CCEE', '#FF8844', '#AEFF44', '#FF4488'];
const MAX_POSSIBLE_LINES = LINE_COLORS.length;
const PASSENGER_SHAPES = ['circle', 'square', 'triangle'];
const TRAIN_SPEED = 150;
const TRAIN_STOP_TIME = 1.3;
const STATION_SPAWN_INTERVAL = 26;
const MIN_STATION_DISTANCE = 112;
const STATION_RADIUS = 16;
const INITIAL_STATIONS = 6;
const INSERT_DETECTION_RADIUS = 72;

/* ═══════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
═══════════════════════════════════════════════════════════ */

// Linear interpolation between two values
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Distance from a point to a line segment and interpolation factor
function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return {
      distance: Math.hypot(px - ax, py - ay),
      interpolation: 0
    };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return {
    distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    interpolation: t
  };
}

// Find the best line segment to insert into
function findBestInsertSegment(line, sx, sy) {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < line.stations.length - 1; i++) {
    const stationA = line.stations[i];
    const stationB = line.stations[i + 1];
    const { distance } = pointToSegmentDistance(sx, sy, stationA.x, stationA.y, stationB.x, stationB.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return {
    segmentIndex: bestIndex,
    distance: bestDistance
  };
}

// Draw a shape (circle, square, or triangle)
function drawShape(context, shapeType, x, y, size) {
  context.beginPath();

  if (shapeType === 'circle') {
    context.arc(x, y, size, 0, Math.PI * 2);
  } else if (shapeType === 'square') {
    const halfSize = size * 1.05;
    context.rect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
  } else if (shapeType === 'triangle') {
    const halfSize = size * 1.15;
    context.moveTo(x, y - halfSize * 1.1);
    context.lineTo(x + halfSize, y + halfSize * 0.7);
    context.lineTo(x - halfSize, y + halfSize * 0.7);
    context.closePath();
  }
}

// Draw a rounded rectangle path
function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

/* ═══════════════════════════════════════════════════════════
   PASSENGER CLASS
═══════════════════════════════════════════════════════════ */

class Passenger {
  constructor(destinationShape) {
    this.destination = destinationShape;
  }
}

/* ═══════════════════════════════════════════════════════════
   STATION CLASS
═══════════════════════════════════════════════════════════ */

class Station {
  constructor(x, y, shape) {
    this.x = x;
    this.y = y;
    this.shape = shape;
    this.passengers = [];
    this.overcrowdingTimer = 0;
    this.spawnAnimation = 0;
    this.connectedLines = [];
  }

  isFull(maxPassengers) {
    return this.passengers.length >= maxPassengers;
  }

  update(deltaTime, maxPassengers) {
    // Animate station spawn
    if (this.spawnAnimation < 1) {
      this.spawnAnimation = Math.min(1, this.spawnAnimation + deltaTime * 1.8);
    }

    // Update crowding timer
    if (this.isFull(maxPassengers)) {
      this.overcrowdingTimer += deltaTime;
    } else {
      this.overcrowdingTimer = Math.max(0, this.overcrowdingTimer - deltaTime * 0.5);
    }
  }

  draw(context, isSelected, maxPassengers, overcrowdLimit, isDarkTheme) {
    const animatedSize = STATION_RADIUS * this.spawnAnimation;
    if (animatedSize < 1) return;

    const dangerLevel = this.isFull(maxPassengers) ? Math.min(1, this.overcrowdingTimer / overcrowdLimit) : 0;

    // Draw glows
    if (dangerLevel > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.009 * (1 + dangerLevel * 4));
      context.shadowColor = `rgba(255, 50, 50, ${dangerLevel * pulse * 0.85})`;
      context.shadowBlur = 34 * dangerLevel;
    }

    if (isSelected) {
      context.shadowColor = isDarkTheme ? 'rgba(255, 255, 140, 0.95)' : 'rgba(60, 60, 0, 0.7)';
      context.shadowBlur = 28;
    }

    // Draw station body
    context.fillStyle = isSelected ? '#ffffa0' : (isDarkTheme ? '#ffffff' : '#0d1117');
    context.strokeStyle = isDarkTheme ? '#0d1117' : '#f0ece2';
    context.lineWidth = 3.5;
    drawShape(context, this.shape, this.x, this.y, animatedSize);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';

    // Draw line membership rings
    if (this.connectedLines.length) {
      const lineCount = this.connectedLines.length;
      const arcSize = Math.PI * 2 / lineCount;

      this.connectedLines.forEach((line, index) => {
        context.beginPath();
        context.arc(this.x, this.y, animatedSize + 6, index * arcSize, (index + 1) * arcSize - 0.1);
        context.strokeStyle = line.color;
        context.lineWidth = 3.5;
        context.stroke();
      });
    }

    // Draw danger arc
    if (dangerLevel > 0) {
      context.beginPath();
      context.arc(this.x, this.y, STATION_RADIUS + 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dangerLevel);
      context.strokeStyle = `rgba(255, ${Math.floor(46 + (1 - dangerLevel) * 114)}, 46, 0.9)`;
      context.lineWidth = 4;
      context.stroke();
    }

    // Draw waiting passengers
    const passengerCount = this.passengers.length;
    if (passengerCount) {
      const visibleCount = Math.min(passengerCount, maxPassengers);
      const columns = 4;
      const spacing = 12.5;
      const dotRadius = 4.8;
      const rows = Math.ceil(visibleCount / columns);
      const baseY = this.y - STATION_RADIUS - 18;

      for (let i = 0; i < visibleCount; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const passengerX = this.x + (col - (Math.min(visibleCount, columns) - 1) / 2) * spacing;
        const passengerY = baseY - (rows - 1 - row) * spacing;

        const dangerColor = dangerLevel > 0.65 ? 'rgba(255, 65, 65, 0.96)'
          : dangerLevel > 0.3 ? 'rgba(255, 175, 45, 0.96)'
          : isDarkTheme ? 'rgba(255, 255, 255, 0.88)' : 'rgba(0, 0, 0, 0.72)';

        context.fillStyle = dangerColor;
        drawShape(context, this.passengers[i].destination, passengerX, passengerY, dotRadius);
        context.fill();
      }

      // Show overflow count
      if (passengerCount > maxPassengers) {
        context.fillStyle = 'rgba(255, 80, 80, 0.9)';
        context.font = 'bold 10px Courier New';
        context.textAlign = 'center';
        context.fillText(`+${passengerCount - maxPassengers}`, this.x, baseY - rows * spacing);
      }
    }

    // Draw shape label
    context.font = 'bold 8px Courier New';
    context.textAlign = 'center';
    context.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.32)';
    context.fillText(this.shape.slice(0, 3).toUpperCase(), this.x, this.y + STATION_RADIUS + 16);
  }
}

/* ═══════════════════════════════════════════════════════════
   TRAIN CLASS
═══════════════════════════════════════════════════════════ */

class Train {
  constructor(line, startingStationIndex = 0, direction = 1) {
    this.line = line;
    this.currentStationIndex = startingStationIndex;
    this.direction = direction;
    this.progressAlongSegment = 0;
    this.state = 'stopped';
    this.stopTimer = TRAIN_STOP_TIME + startingStationIndex * 0.6;
    this.passengers = [];
    this.x = line.stations[startingStationIndex].x;
    this.y = line.stations[startingStationIndex].y;
    this.angle = 0;
  }

  update(deltaTime) {
    const stations = this.line.stations;
    if (stations.length < 2) return;

    if (this.state === 'stopped') {
      this.stopTimer -= deltaTime;
      if (this.stopTimer <= 0) {
        this.pickupPassengers();
        this.state = 'moving';
      }
      return;
    }

    // Check boundaries and reverse if needed
    if (this.currentStationIndex + this.direction < 0 || this.currentStationIndex + this.direction >= stations.length) {
      this.direction *= -1;
    }

    const currentStation = stations[this.currentStationIndex];
    const nextStation = stations[this.currentStationIndex + this.direction];
    const segmentDistance = Math.max(1, Math.hypot(nextStation.x - currentStation.x, nextStation.y - currentStation.y));

    this.angle = Math.atan2(nextStation.y - currentStation.y, nextStation.x - currentStation.x);
    this.progressAlongSegment += (TRAIN_SPEED / segmentDistance) * deltaTime;
    this.x = lerp(currentStation.x, nextStation.x, this.progressAlongSegment);
    this.y = lerp(currentStation.y, nextStation.y, this.progressAlongSegment);

    // Move to next station
    if (this.progressAlongSegment >= 1) {
      this.currentStationIndex += this.direction;
      this.progressAlongSegment = 0;
      this.x = stations[this.currentStationIndex].x;
      this.y = stations[this.currentStationIndex].y;
      this.state = 'stopped';
      this.stopTimer = TRAIN_STOP_TIME;
    }
  }

  pickupPassengers() {
    const station = this.line.stations[this.currentStationIndex];

    // Drop off passengers at destination
    for (let i = this.passengers.length - 1; i >= 0; i--) {
      if (this.passengers[i].destination === station.shape) {
        this.passengers.splice(i, 1);
        gameInstance.onPassengerDelivered(station);
      }
    }

    // Pick up all waiting passengers
    while (station.passengers.length > 0) {
      this.passengers.push(station.passengers.shift());
    }
  }

  draw(context, isDarkTheme) {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);

    const width = 29;
    const height = 14;
    const cornerRadius = 4;

    context.shadowColor = this.line.color;
    context.shadowBlur = 15;
    drawRoundedRect(context, -width / 2, -height / 2, width, height, cornerRadius);
    context.fillStyle = this.line.color;
    context.fill();
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';

    // Draw train outline
    context.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.22)';
    context.lineWidth = 1.6;
    drawRoundedRect(context, -width / 2, -height / 2, width, height, cornerRadius);
    context.stroke();

    // Draw separator line
    context.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.14)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width / 2 - 6, -height / 2 + 2);
    context.lineTo(width / 2 - 6, height / 2 - 2);
    context.stroke();

    // Draw passenger indicators
    const passengerCount = this.passengers.length;
    if (passengerCount) {
      const maxShown = 12;
      const shownCount = Math.min(passengerCount, maxShown);
      const spacing = Math.min(4, (width - 10) / shownCount);
      const startX = -(shownCount - 1) * spacing / 2;

      context.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.55)';
      for (let i = 0; i < shownCount; i++) {
        context.beginPath();
        context.arc(startX - 1 + i * spacing, 0, 2.3, 0, Math.PI * 2);
        context.fill();
      }

      // Show overflow count
      if (passengerCount > maxShown) {
        context.font = 'bold 8px Courier New';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.7)';
        context.fillText(`+${passengerCount - maxShown}`, width / 2 - 4, 0);
        context.textBaseline = 'alphabetic';
      }
    }

    context.restore();
  }
}

/* ═══════════════════════════════════════════════════════════
   LINE CLASS
═══════════════════════════════════════════════════════════ */

class Line {
  constructor(color) {
    this.color = color;
    this.stations = [];
    this.trains = [];
  }

  addStation(station) {
    this.stations.push(station);
    this.updateConnections();
    if (this.stations.length === 2) {
      this.trains.push(new Train(this, 0, 1));
    }
  }

  prependStation(station) {
    this.stations.unshift(station);
    this.trains.forEach(train => {
      train.currentStationIndex = Math.min(train.currentStationIndex + 1, this.stations.length - 1);
    });
    this.updateConnections();
    if (this.stations.length === 2) {
      this.trains.push(new Train(this, 0, 1));
    }
  }

  insertAfter(segmentIndex, station) {
    this.stations.splice(segmentIndex + 1, 0, station);
    this.trains.forEach(train => {
      if (train.currentStationIndex > segmentIndex) {
        train.currentStationIndex = Math.min(train.currentStationIndex + 1, this.stations.length - 1);
      }
    });
    this.updateConnections();
  }

  addTrain() {
    const middleIndex = Math.floor(this.stations.length / 2);
    const direction = (this.trains.length % 2 === 0) ? 1 : -1;
    const newTrain = new Train(this, middleIndex, direction);
    newTrain.stopTimer = TRAIN_STOP_TIME * 2;
    this.trains.push(newTrain);
  }

  updateConnections() {
    this.stations.forEach(station => {
      if (!station.connectedLines.includes(this)) {
        station.connectedLines.push(this);
      }
    });
  }

  hasStation(station) {
    return this.stations.includes(station);
  }

  isTailEnd(station) {
    return this.stations.length > 0 && station === this.stations[this.stations.length - 1];
  }

  isHeadEnd(station) {
    return this.stations.length > 0 && station === this.stations[0];
  }

  update(deltaTime) {
    this.trains.forEach(train => train.update(deltaTime));
  }

  draw(context, isDarkTheme, lineNumericalIndex) {
    if (this.stations.length < 2) return;

    context.shadowColor = this.color;
    context.shadowBlur = 16;
    context.strokeStyle = this.color;
    context.lineWidth = 7;
    context.lineCap = context.lineJoin = 'round';
    context.globalAlpha = 0.28;
    this.drawPath(context);
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.lineWidth = 5;
    this.drawPath(context);
    context.shadowColor = 'transparent';

    // Draw line label near midpoint
    const midIndex = Math.floor((this.stations.length - 1) / 2);
    const stationA = this.stations[midIndex];
    const stationB = this.stations[midIndex + 1] || stationA;
    const labelX = (stationA.x + stationB.x) / 2;
    const labelY = (stationA.y + stationB.y) / 2;

    context.save();
    context.font = 'bold 11px Courier New';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const label = `L${lineNumericalIndex + 1}`;
    const labelWidth = context.measureText(label).width + 12;
    drawRoundedRect(context, labelX - labelWidth / 2, labelY - 9, labelWidth, 18, 5);
    context.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.72)';
    context.fill();
    context.fillStyle = this.color;
    context.fillText(label, labelX, labelY);
    context.restore();
    context.textBaseline = 'alphabetic';

    this.trains.forEach(train => train.draw(context, isDarkTheme));
  }

  drawPath(context) {
    context.beginPath();
    context.moveTo(this.stations[0].x, this.stations[0].y);
    for (let i = 1; i < this.stations.length; i++) {
      context.lineTo(this.stations[i].x, this.stations[i].y);
    }
    context.stroke();
  }
}

/* ═══════════════════════════════════════════════════════════
   MAIN GAME CLASS
═══════════════════════════════════════════════════════════ */

class Game {
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
    this.isRunning = false;
    this.isPaused = false;

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

  /* ── Theme Management ── */
  toggleTheme() {
    this.theme = this.isDarkTheme ? 'light' : 'dark';
    document.body.classList.toggle('light', !this.isDarkTheme);
    const themeBtn = document.getElementById('theme-btn');
    document.getElementById('theme-icon').textContent = this.isDarkTheme ? '☀' : '☾';
    themeBtn.querySelector('span:last-child').textContent = this.isDarkTheme ? 'LIGHT' : 'DARK';
  }

  /* ── Pause Management ── */
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

  /* ── Menu Rendering ── */
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
    overlay.innerHTML = `
      <div class="go-title">GAME OVER LOL</div>
      <div class="go-reason">A STATION WAS OVERWHELMED BY WAITING PASSENGERS BECAUSE U DIDNT CATE ANOUT THEM</div>
      <div class="go-score">${this.score}</div>
      <div class="go-sub">POINTS  ·  ${this.currentDifficulty.label} MODE</div>
      <div class="go-btns">
        <button class="ov-btn" id="go-retry">↺ LETS PLAY AGAIN!</button>
        <button class="ov-btn dim" id="go-menu">⌂ BACK TO MENU</button>
      </div>`;

    document.getElementById('go-retry').addEventListener('click', () => this.startGame(this.currentDifficulty));
    document.getElementById('go-menu').addEventListener('click', () => this.showMainMenu());
  }

  /* ── Game Start ── */
  startGame(difficultyConfig) {
    this.currentDifficulty = difficultyConfig;
    this.stations = [];
    this.lines = [];
    this.maxLines = difficultyConfig.startingLines;
    this.selectedStation = null;
    this.activeLineIndex = -1;
    this.score = 0;
    this.floatingTexts = [];
    this.passSpawnTimer = -5; // Delay passenger spawning for 5 seconds at start
    this.stationSpawnTimer = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.insertPreview = null;

    document.getElementById('pause-overlay').classList.remove('vis');
    if (this.isHTPDrawerOpen) this.toggleHTPDrawer();

    // Reset pause button state
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

  /* ── Station & Passenger Spawning ── */
  spawnStation() {
    const margin = 90;
    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let attempt = 0; attempt < 160; attempt++) {
      const x = margin + Math.random() * (width - margin * 2);
      const y = margin + Math.random() * (height - margin * 2);

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

  /* ── Shop Functions ── */
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
    this.maxLines++;
    this.updateHUD();
    this.updatePanel();
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
    line.addTrain();
    this.updateHUD();
    this.updatePanel();
    this.showFlashMessage(`TRAIN ADDED  ·  ${line.trains.length} TRAINS ON LINE ${this.activeLineIndex + 1}`);
  }

  getLinePurchaseCost() {
    return this.currentDifficulty.newLineCost * (this.maxLines - this.currentDifficulty.startingLines + 1);
  }

  getTrainPurchaseCost(line) {
    return this.currentDifficulty.newTrainCost * line.trains.length;
  }

  /* ── Panel Management ── */
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

  /* ── Input Handling ── */
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
    // Helper to try extending a line
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

    // 0. Handle insert preview
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

    // 1. Try active line
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

    // 2. Try auto-extend on any line endpoint
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

    // 3. Try inserting into midline
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

    // 4. Try inserting reverse
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

    // 5. Check if already connected
    if (this.lines.some(line => line.hasStation(fromStation) && line.hasStation(toStation))) {
      this.showFlashMessage('ALREADY CONNECTED ON A LINE');
      return;
    }

    // 6. Create new line
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

  /* ── Callbacks & UI Updates ── */
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

  /* ── Game Update & Render ── */
  update(deltaTime) {
    if (!this.isRunning || this.isPaused) return;

    // Spawn stations periodically
    this.stationSpawnTimer += deltaTime;
    if (this.stationSpawnTimer >= STATION_SPAWN_INTERVAL) {
      this.stationSpawnTimer = 0;
      this.spawnStation();
    }

    // Spawn passengers periodically
    this.passSpawnTimer += deltaTime;
    if (this.passSpawnTimer >= this.currentDifficulty.passSpawnInterval) {
      this.passSpawnTimer = 0;
      this.spawnPassenger();
      if (Math.random() < 0.4) this.spawnPassenger();
    }

    // Update all game entities
    this.stations.forEach(stn => stn.update(deltaTime, this.currentDifficulty.maxPassengers));
    this.lines.forEach(line => line.update(deltaTime));

    // Update floating text
    this.floatingTexts = this.floatingTexts.filter(f => f.timer > 0);
    this.floatingTexts.forEach(f => f.timer -= deltaTime);

    // Check for game over
    if (this.stations.some(stn => stn.overcrowdingTimer >= this.currentDifficulty.overcrowdLimit)) {
      this.showGameOverScreen();
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const isDark = this.isDarkTheme;

    // Draw background
    ctx.fillStyle = isDark ? '#0d1117' : '#f0ece2';
    ctx.fillRect(0, 0, width, height);

    // Draw dot grid
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.026)' : 'rgba(0, 0, 0, 0.048)';
    for (let gx = 48; gx < width; gx += 48) {
      for (let gy = 48; gy < height; gy += 48) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!this.isRunning) return;

    // Draw lines and trains
    this.lines.forEach((line, index) => line.draw(ctx, isDark, index));

    // Draw insert preview highlight
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

    // Draw preview dashed line from selected station to mouse
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

    // Draw all stations
    this.stations.forEach(stn => stn.draw(ctx, stn === this.selectedStation, this.currentDifficulty.maxPassengers, this.currentDifficulty.overcrowdLimit, isDark));

    // Draw floating point text
    this.floatingTexts.forEach(floatingText => {
      const progress = floatingText.timer / floatingText.maxTime;
      ctx.globalAlpha = progress;
      ctx.fillStyle = isDark ? '#f5e642' : '#8a5e00';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`+${floatingText.value}`, floatingText.x, floatingText.y - (1 - progress) * 42);
    });
    ctx.globalAlpha = 1;

    // Draw context hint bar
    const contextHint = this.selectedStation
      ? (this.insertPreview
        ? '⊕  CLICK TO INSERT INTO THE GLOWING LINE'
        : 'CLICK ANOTHER STATION TO CONNECT   ·   ESC TO CANCEL')
      : this.activeLineIndex >= 0
        ? `LINE ${this.activeLineIndex + 1} SELECTED   ·   CLICK STATION TO EXTEND   OR   CLICK ADD TRAIN BELOW`
        : 'CLICK ANY STATION TO DRAW A LINE   ·   SELECT A SWATCH BELOW TO EXTEND A SPECIFIC LINE';

    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    const hintWidth = ctx.measureText(contextHint).width + 28;
    const hintX = width / 2;
    const hintY = height - 76;

    drawRoundedRect(ctx, hintX - hintWidth / 2, hintY - 14, hintWidth, 22, 11);
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.75)';
    ctx.fill();
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.72)';
    ctx.fillText(contextHint, hintX, hintY);

    // Draw pause overlay dim
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

/* ── Initialize Game ── */
const gameInstance = new Game();

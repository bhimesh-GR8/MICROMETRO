'use strict';

import { TRAIN_STOP_TIME, TRAIN_SPEED, STATION_RADIUS } from './constants.js';
import { drawShape, drawRoundedRect, lerp } from './utils.js';

export class Passenger {
  constructor(destinationShape) {
    this.destination = destinationShape;
  }
}

export class Station {
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
    if (this.spawnAnimation < 1) {
      this.spawnAnimation = Math.min(1, this.spawnAnimation + deltaTime * 1.8);
    }

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

    if (dangerLevel > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.009 * (1 + dangerLevel * 4));
      context.shadowColor = `rgba(255, 50, 50, ${dangerLevel * pulse * 0.85})`;
      context.shadowBlur = 34 * dangerLevel;
    }

    if (isSelected) {
      context.shadowColor = isDarkTheme ? 'rgba(255, 255, 140, 0.95)' : 'rgba(60, 60, 0, 0.7)';
      context.shadowBlur = 28;
    }

    context.fillStyle = isSelected ? '#ffffa0' : (isDarkTheme ? '#ffffff' : '#0d1117');
    context.strokeStyle = isDarkTheme ? '#0d1117' : '#f0ece2';
    context.lineWidth = 3.5;
    drawShape(context, this.shape, this.x, this.y, animatedSize);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';

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

    if (dangerLevel > 0) {
      context.beginPath();
      context.arc(this.x, this.y, STATION_RADIUS + 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dangerLevel);
      context.strokeStyle = `rgba(255, ${Math.floor(46 + (1 - dangerLevel) * 114)}, 46, 0.9)`;
      context.lineWidth = 4;
      context.stroke();
    }

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

      if (passengerCount > maxPassengers) {
        context.fillStyle = 'rgba(255, 80, 80, 0.9)';
        context.font = 'bold 10px Courier New';
        context.textAlign = 'center';
        context.fillText(`+${passengerCount - maxPassengers}`, this.x, baseY - rows * spacing);
      }
    }

    context.font = 'bold 8px Courier New';
    context.textAlign = 'center';
    context.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.32)';
    context.fillText(this.shape.slice(0, 3).toUpperCase(), this.x, this.y + STATION_RADIUS + 16);
  }
}

export class Train {
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

    for (let i = this.passengers.length - 1; i >= 0; i--) {
      if (this.passengers[i].destination === station.shape) {
        this.passengers.splice(i, 1);
        if (window.gameInstance && typeof window.gameInstance.onPassengerDelivered === 'function') {
          window.gameInstance.onPassengerDelivered(station);
        }
      }
    }

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

    context.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.22)';
    context.lineWidth = 1.6;
    drawRoundedRect(context, -width / 2, -height / 2, width, height, cornerRadius);
    context.stroke();

    context.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.14)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width / 2 - 6, -height / 2 + 2);
    context.lineTo(width / 2 - 6, height / 2 - 2);
    context.stroke();

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

export class Line {
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

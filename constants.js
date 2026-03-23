'use strict';

export const DIFFICULTY_MODES = {
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

export const LINE_COLORS = ['#FF4444', '#4d9ef7', '#2ecc71', '#FFBB33', '#b76aff', '#FF44CC', '#00CCEE', '#FF8844', '#AEFF44', '#FF4488'];
export const MAX_POSSIBLE_LINES = LINE_COLORS.length;
export const PASSENGER_SHAPES = ['circle', 'square', 'triangle'];
export const TRAIN_SPEED = 150;
export const TRAIN_STOP_TIME = 1.3;
export const STATION_SPAWN_INTERVAL = 26;
export const MIN_STATION_DISTANCE = 112;
export const MAX_STATIONS = 28;
export const STATION_RADIUS = 16;
export const INITIAL_STATIONS = 6;
export const INSERT_DETECTION_RADIUS = 72;

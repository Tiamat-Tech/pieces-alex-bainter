import * as tonal from 'tonal';
import shuffle from 'shuffle-array';
import * as Tone from 'tone';
import {
  createSampler,
  getRandomElement,
  getRandomNumberBetween,
  wrapActivate,
} from '@generative-music/utilities';
import { sampleNames } from '../pinwheels.gfm.manifest.json';

const P_SPAWN_TWO = 0.33;
const OCTAVES = [3, 4, 5];
const TONICS = tonal.Note.names().reduce(
  (notesWithOctaves, noteName) =>
    notesWithOctaves.concat(OCTAVES.map(octave => `${noteName}${octave}`)),
  []
);
const MIN_MAX_DELAY_S = 2;
const MAX_MAX_DELAY_S = 5;
const MIN_MIN_DELAY_S = 0.075;
const MAX_MIN_DELAY_S = 0.3;
const MAX_INVERSION = 3;
const MIN_ACCELERATION_MULTIPLIER = 0.85;
const MAX_ACCELERATION_MULTIPLIER = 0.95;
const MIN_DECELERATION_MULTIPLIER = 1.05;
const MAX_DECELERATION_MULTIPLIER = 1.15;
const CHORD_TYPE = 'm7';

function* makeArrayLooper(arr) {
  for (let i = 0; i < arr.length; i === arr.length - 1 ? (i = 0) : (i += 1)) {
    yield arr[i];
  }
}

const getNewMaxDelay = () =>
  getRandomNumberBetween(MIN_MAX_DELAY_S, MAX_MAX_DELAY_S);

const startPinwheelChain = instrument => {
  const generatePinwheel = (
    tonic = getRandomElement(TONICS),
    maxDelay = getNewMaxDelay(),
    spawnAnother = true
  ) => {
    const inversion = Math.floor(0, MAX_INVERSION + 1);
    const intervals = tonal.Chord.intervals(CHORD_TYPE);
    const notes = intervals.map((interval, i) =>
      tonal.Distance.transpose(
        tonic,
        i < inversion ? tonal.Interval.invert(interval) : interval
      )
    );
    const noteGenerator = makeArrayLooper(shuffle(notes));
    const minDelay = getRandomNumberBetween(MIN_MIN_DELAY_S, MAX_MIN_DELAY_S);
    const playNextNote = (delay, multiplier) => {
      Tone.Transport.scheduleOnce(() => {
        instrument.triggerAttack(noteGenerator.next().value, '+1');
        const nextDelay = delay * multiplier;
        if (nextDelay < minDelay) {
          playNextNote(
            nextDelay,
            getRandomNumberBetween(
              MIN_DECELERATION_MULTIPLIER,
              MAX_DECELERATION_MULTIPLIER
            )
          );
        } else if (nextDelay > maxDelay) {
          if (spawnAnother) {
            Tone.Transport.scheduleOnce(() => {
              if (Math.random() < P_SPAWN_TWO) {
                const nextLetter = getRandomElement(tonal.Note.names());
                const shuffledOctaves = shuffle(OCTAVES.slice(0));
                const delay1 = getNewMaxDelay();
                const delay2 = getNewMaxDelay();
                generatePinwheel(
                  `${nextLetter}${shuffledOctaves.pop()}`,
                  delay1,
                  delay1 >= delay2
                );
                generatePinwheel(
                  `${nextLetter}${shuffledOctaves.pop()}`,
                  delay2,
                  delay1 < delay2
                );
              } else {
                generatePinwheel();
              }
            }, `+${getNewMaxDelay()}`);
          }
        } else {
          playNextNote(nextDelay, multiplier);
        }
      }, `+${delay}`);
    };
    playNextNote(
      maxDelay,
      getRandomNumberBetween(
        MIN_ACCELERATION_MULTIPLIER,
        MAX_ACCELERATION_MULTIPLIER
      )
    );
  };
  generatePinwheel();
};

const getPiano = samples => createSampler(samples['vsco2-piano-mf']);

const activate = async ({ destination, sampleLibrary }) => {
  const samples = await sampleLibrary.request(Tone.context, sampleNames);
  const piano = await getPiano(samples);
  piano.connect(destination);
  const schedule = () => {
    startPinwheelChain(piano);
    return () => {
      piano.releaseAll();
    };
  };
  const deactivate = () => {
    piano.dispose();
  };
  return [deactivate, schedule];
};

export default wrapActivate(activate);

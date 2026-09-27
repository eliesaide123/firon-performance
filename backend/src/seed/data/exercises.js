'use strict';

/**
 * Exercise library (CONTRACT §9) — the 28 movements the PT plan builder offers.
 * `type` is the one-line descriptor the prototype renders under the name
 * ("Compound · barbell").
 *
 * `demoMediaRef` links to a seeded MediaAsset (see `media.js`).
 */

// [name, muscleGroup, equipment, type, cue]
const ROWS = [
  ['Back Squat', 'Legs', 'Barbell', 'Compound · barbell', 'Brace hard, knees track over toes, hit depth under control.'],
  ['Bench Press', 'Chest', 'Barbell', 'Compound · barbell', 'Shoulder blades pinned, bar to lower chest, press in a slight arc.'],
  ['Deadlift', 'Posterior chain', 'Barbell', 'Compound · barbell', 'Bar over mid-foot, chest proud, push the floor away.'],
  ['Pull-up', 'Back', 'Bodyweight', 'Compound · bodyweight', 'Start from a dead hang, drive elbows to your ribs.'],
  ['Overhead Press', 'Shoulders', 'Barbell', 'Compound · barbell', 'Ribs down, squeeze glutes, press and finish with biceps by your ears.'],
  ['Bulgarian Split Squat', 'Legs', 'Dumbbells', 'Unilateral · dumbbells', 'Front shin vertical, drop straight down, drive through the whole foot.'],
  ['Goblet Squat', 'Legs', 'Kettlebell', 'Compound · kettlebell', 'Elbows inside the knees, chest tall, sit between your hips.'],
  ['Romanian Deadlift', 'Hamstrings', 'Barbell', 'Hinge · barbell', 'Soft knees, push the hips back, feel the hamstrings load.'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbells', 'Compound · dumbbells', 'Wrists over elbows, control the stretch, press to lockout.'],
  ['Walking Lunge', 'Legs', 'Dumbbells', 'Unilateral · dumbbells', 'Long stride, torso upright, knee kisses the floor.'],
  ['Plank Hold', 'Core', 'Bodyweight', 'Isometric · bodyweight', 'Squeeze glutes, tuck the ribs, breathe through the hold.'],
  ['Lat Pulldown', 'Back', 'Cable', 'Compound · cable', 'Chest up, pull the bar to your collarbone, no swinging.'],
  ['Leg Press', 'Legs', 'Machine', 'Compound · machine', 'Feet flat, stop just short of lockout, keep the lower back glued.'],
  ['Bicep Curl', 'Biceps', 'Dumbbells', 'Isolation · dumbbells', 'Elbows pinned to your sides, no swinging, squeeze at the top.'],
  ['Seated Row', 'Back', 'Cable', 'Compound · cable', 'Tall spine, pull to the navel, pause for one count.'],
  ['Treadmill Run', 'Conditioning', 'Treadmill', 'Cardio · treadmill', 'Relaxed shoulders, quick cadence, breathe on a rhythm.'],
  ['Burpees', 'Full body', 'Bodyweight', 'Conditioning · bodyweight', 'Chest to floor, hips and shoulders rise together, land soft.'],
  ['Kettlebell Swing', 'Posterior chain', 'Kettlebell', 'Ballistic · kettlebell', 'Hinge not squat — snap the hips and let the bell float.'],
  ['Row Intervals', 'Conditioning', 'Rowing machine', 'Cardio · rower', 'Legs, then back, then arms — reverse it on the recovery.'],
  ['Mountain Climbers', 'Core', 'Bodyweight', 'Conditioning · bodyweight', 'Hips low and quiet, drive the knees, keep the core braced.'],
  ['Barbell Row', 'Back', 'Barbell', 'Compound · barbell', 'Hinge to 45°, pull to the belly button, control the lower.'],
  ['Face Pull', 'Rear delts', 'Cable', 'Isolation · cable', 'Rope to the forehead, elbows high, externally rotate at the end.'],
  ['Hammer Curl', 'Biceps', 'Dumbbells', 'Isolation · dumbbells', 'Neutral grip, no swing, slow on the way down.'],
  ['Cable Fly', 'Chest', 'Cable', 'Isolation · cable', 'Slight elbow bend, hug a barrel, squeeze the chest at the middle.'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight', 'Isolation · bodyweight', 'No swing — curl the pelvis, lower with control.'],
  ['Assault Bike', 'Conditioning', 'Air bike', 'Cardio · air bike', 'Push and pull the handles, drive the legs, stay off the seat edge.'],
  ['Sled Push', 'Legs', 'Sled', 'Conditioning · sled', 'Low body angle, short choppy steps, never stop driving.'],
  ['Farmer Carry', 'Grip', 'Dumbbells', 'Loaded carry · dumbbells', 'Tall and tight, ribs down, walk without leaning.'],
];

const DEMOS = {
  Deadlift: { demoMediaRef: 'deadlift-cue', demoDurationLabel: '0:45' },
  'Kettlebell Swing': { demoMediaRef: 'kb-swing', demoDurationLabel: '0:32' },
};

const slugify = (name) =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = ROWS.map(([name, muscleGroup, equipment, type, cue]) => ({
  name,
  slug: slugify(name),
  description: `${type} — ${muscleGroup.toLowerCase()} focus.`,
  muscleGroup,
  equipment,
  type,
  cues: [cue],
  isActive: true,
  ...(DEMOS[name] || {}),
}));

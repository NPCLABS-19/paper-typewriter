export const MACHINES = {
  olympia: {
    name: 'Olympia SM3', color: '#982d29', finish: 0x861d1e, kind: 'manual',
    shape: 'rounded', ink: [25, 19, 17], pressure: .41, variation: .18,
    strike: .054, release: .077, step: .085, returnBase: .32, returnTravel: .35,
  },
  lettera: {
    name: 'Olivetti Lettera 22', color: '#638e7f', finish: 0x477566, kind: 'manual',
    shape: 'compact', ink: [30, 29, 34], pressure: .29, variation: .13,
    strike: .038, release: .059, step: .063, returnBase: .21, returnTravel: .24,
  },
  selectric: {
    name: 'IBM Selectric II', color: '#d3bb8d', finish: 0xd5bd90, kind: 'electric',
    shape: 'electric', ink: [15, 14, 14], pressure: .38, variation: .04,
    strike: .025, release: .045, step: .046, returnBase: .18, returnTravel: .18,
    autoReturn: true,
  },
};

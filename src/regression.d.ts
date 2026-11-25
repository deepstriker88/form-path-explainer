export type FixtureVerdict='accepted'|'rejected'|'indeterminate';
export type FixtureCategory='unchangedAccepted'|'unchangedRejected'|'newlyRejected'|'newlyAccepted'|'indeterminate';
export interface RegressionReport {count:number;counts:Record<FixtureCategory,number>;results:Array<{index:number;before:FixtureVerdict;after:FixtureVerdict;category:FixtureCategory}>;comparable:boolean;hasNewRejections:boolean;hasNewAcceptances:boolean}
export function compareFormFixtures(fixturesText:string,beforeText:string,afterText:string):RegressionReport;

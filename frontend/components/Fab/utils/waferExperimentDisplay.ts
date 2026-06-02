type RequestExperiment = {
  id: number;
  name: string;
  group: string;
};

type ExperimentRollup = {
  experimentTypeId: number | null;
  experimentName: string;
  status: string;
  verdict: string | null;
};

type WaferExperiment = RequestExperiment & {
  status: string;
  verdict: string | null;
};

const getWaferExperimentDisplay = (
  requestExperiments: RequestExperiment[],
  rollup: ExperimentRollup[],
) => {
  const requestExperimentById = new Map(
    requestExperiments.map((experiment) => [experiment.id, experiment]),
  );
  const experiments: WaferExperiment[] = rollup.flatMap((row) => {
    if (row.experimentTypeId == null) return [];
    const requestExperiment = requestExperimentById.get(row.experimentTypeId);
    return [
      {
        id: row.experimentTypeId,
        name: row.experimentName || requestExperiment?.name || '',
        group: requestExperiment?.group || '',
        status: row.status,
        verdict: row.verdict,
      },
    ];
  });

  return {
    experiments,
    total: experiments.length,
    doneCount: experiments.filter((experiment) => experiment.status === 'done').length,
  };
};

export default getWaferExperimentDisplay;
export { getWaferExperimentDisplay };

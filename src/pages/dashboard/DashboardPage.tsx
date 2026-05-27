import type { FeatureWorkspace } from "../../features/workspaces/schema/workspace";
import { Button } from "../../components/form/FormControls";

type DashboardPageProps = {
  designs: FeatureWorkspace[];
  onCreate: () => void;
  onOpen: (designId: string) => void;
  onLoadSample: () => void;
};

export const DashboardPage = ({ designs, onCreate, onOpen, onLoadSample }: DashboardPageProps) => (
  <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
    <section className="rounded-[28px] border border-white/70 bg-ink p-6 text-white shadow-panel">
      <p className="text-xs uppercase tracking-[0.3em] text-sand/80">ArchFlow</p>
      <h1 className="mt-3 max-w-lg text-3xl font-semibold leading-tight">
        Guided firmware feature discovery, from rough requirement to component architecture draft.
      </h1>
      <p className="mt-4 max-w-xl text-sm text-white/75">
        Capture a feature requirement, discover candidate components, define relationships, refine component state, and export a working design draft without forcing a backend.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onCreate} tone="primary">
          Create Feature Workspace
        </Button>
        <Button onClick={onLoadSample}>Load Sample Workspace</Button>
      </div>
    </section>

    <section className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-panel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-copper">Dashboard</p>
          <h2 className="mt-2 text-2xl font-semibold">Saved Feature Workspaces</h2>
        </div>
        <p className="text-sm text-slate">{designs.length} workspace(s) in local storage</p>
      </div>

      <div className="mt-6 grid gap-4">
        {designs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate/25 bg-mist/70 p-8 text-center text-slate">
            No saved workspaces yet. Start with an empty feature workspace or the sample UART scenario.
          </div>
        ) : (
          designs.map((design) => (
            <button
              key={design.id}
              type="button"
              onClick={() => onOpen(design.id)}
              className="rounded-2xl border border-slate/10 bg-mist/65 p-5 text-left transition hover:-translate-y-0.5 hover:border-copper/40 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{design.title}</h3>
                  <p className="mt-2 text-sm text-slate">
                    {design.requirement || "No requirement entered yet."}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-copper">
                  Open
                </span>
              </div>
              <p className="mt-4 text-xs text-slate">
                Updated {new Date(design.updatedAt).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </div>
    </section>
  </div>
);

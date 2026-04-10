import { zodResolver } from "@hookform/resolvers/zod";
import type { DeviceSummary, TerrariumCreateInput } from "@biot/shared";
import { terrariumCreateSchema } from "@biot/shared";
import { useForm } from "react-hook-form";

type Props = {
  title: string;
  submitLabel: string;
  devices: DeviceSummary[];
  initialValues: TerrariumCreateInput;
  isSaving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (values: TerrariumCreateInput) => void;
};

export function TerrariumFormDialog(props: Props) {
  const form = useForm<TerrariumCreateInput>({
    resolver: zodResolver(terrariumCreateSchema),
    defaultValues: props.initialValues
  });

  return (
    <div className="dialog-backdrop" onClick={props.onClose} role="presentation">
      <div className="dialog-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-header">
          <div>
            <h2>{props.title}</h2>
            <p>Configure limits and optionally bind a discovered HARDWARIO device.</p>
          </div>
          <button className="ghost-button" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>

        <form
          className="form-grid"
          onSubmit={form.handleSubmit((values) =>
            props.onSubmit({
              ...values,
              speciesName: values.speciesName?.trim() || undefined,
              notes: values.notes?.trim() || undefined,
              deviceId: values.deviceId || null
            })
          )}
        >
          <label>
            <span>Name</span>
            <input {...form.register("name")} placeholder="Panther Chameleon" />
            <small>{form.formState.errors.name?.message}</small>
          </label>

          <label>
            <span>Species</span>
            <input {...form.register("speciesName")} placeholder="Furcifer pardalis" />
          </label>

          <label className="full-span">
            <span>Assigned device</span>
            <select {...form.register("deviceId")}>
              <option value="">No device assigned</option>
              {props.devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.externalId}
                  {device.assignedTerrariumId ? " (assigned)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Min temperature</span>
            <input type="number" step="0.1" {...form.register("minTemperatureC", { valueAsNumber: true })} />
            <small>{form.formState.errors.minTemperatureC?.message}</small>
          </label>

          <label>
            <span>Max temperature</span>
            <input type="number" step="0.1" {...form.register("maxTemperatureC", { valueAsNumber: true })} />
            <small>{form.formState.errors.maxTemperatureC?.message}</small>
          </label>

          <label>
            <span>Min humidity</span>
            <input type="number" step="0.1" {...form.register("minHumidityPct", { valueAsNumber: true })} />
            <small>{form.formState.errors.minHumidityPct?.message}</small>
          </label>

          <label>
            <span>Max humidity</span>
            <input type="number" step="0.1" {...form.register("maxHumidityPct", { valueAsNumber: true })} />
            <small>{form.formState.errors.maxHumidityPct?.message}</small>
          </label>

          <label className="full-span">
            <span>Notes</span>
            <textarea rows={4} {...form.register("notes")} placeholder="Special care instructions" />
          </label>

          {props.errorMessage ? <div className="form-error">{props.errorMessage}</div> : null}

          <div className="dialog-actions full-span">
            <button className="ghost-button" type="button" onClick={props.onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={props.isSaving}>
              {props.isSaving ? "Saving..." : props.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

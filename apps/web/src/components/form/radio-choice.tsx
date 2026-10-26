"use client";

/**
 * A row of radio buttons under a legend, for picking one of a few options that change the rest of a form.
 *
 * @param props - Component props.
 * @param props.legend - What is picked.
 * @param props.name - The field's name in the submitted form.
 * @param props.options - The options, in order.
 * @param props.value - The picked option.
 * @param props.onChange - Called with the option the user picks.
 * @param props.labelOf - Gives an option's label.
 * @returns The fieldset.
 */
export function RadioChoice<Option extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  labelOf,
}: {
  legend: string;
  name: string;
  options: readonly Option[];
  value: Option;
  onChange: (option: Option) => void;
  labelOf: (option: Option) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="accent-primary" />
            {labelOf(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

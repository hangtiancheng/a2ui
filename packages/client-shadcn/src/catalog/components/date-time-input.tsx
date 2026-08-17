import { useId } from "react"

import { createComponentImplementation } from "@a2ui/react/v0_9"
import { DateTimeInputApi } from "@a2ui/web_core/v0_9/basic_catalog"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function normalizeDateTimeValue(
  value: string | null | undefined,
  type: string
): string {
  if (!value) return ""

  const hasT = value.includes("T")
  const split = value.split("T")

  const datePart = (hasT ? split[0] : value)?.substring(0, 10) ?? ""
  const timePart = (hasT ? split[1] : value)?.substring(0, 5) ?? ""

  switch (type) {
    case "date":
      return datePart
    case "time":
      return timePart
    case "datetime-local":
      return `${datePart}T${timePart}`
  }
  return ""
}

export const DateTimeInput = createComponentImplementation(
  DateTimeInputApi,
  ({ props }) => {
    const id = useId()

    if (!(props.enableDate || props.enableTime)) return null

    let type = "datetime-local"
    if (props.enableDate && !props.enableTime) type = "date"
    if (!props.enableDate && props.enableTime) type = "time"

    const value = normalizeDateTimeValue(props.value, type)

    return (
      <Field>
        {props.label && <FieldLabel htmlFor={id}>{props.label}</FieldLabel>}
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => props.setValue(e.target.value)}
          min={typeof props.min === "string" ? props.min : undefined}
          max={typeof props.max === "string" ? props.max : undefined}
        />
      </Field>
    )
  }
)

import { useId, useState } from "react"

import { createComponentImplementation } from "@a2ui/react/v0_9"
import { DateTimeInputApi } from "@a2ui/web_core/v0_9/basic_catalog"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function splitValue(value: string | null | undefined): {
  date: string
  time: string
} {
  if (!value) return { date: "", time: "" }

  const hasT = value.includes("T")
  const split = value.split("T")
  const rawDate = (hasT ? split[0] : value) ?? ""
  const rawTime = (hasT ? split[1] : value) ?? ""

  return {
    date: /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.substring(0, 10) : "",
    time: /^\d{2}:\d{2}/.test(rawTime) ? rawTime.substring(0, 5) : "",
  }
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export const DateTimeInput = createComponentImplementation(
  DateTimeInputApi,
  ({ props }) => {
    const id = useId()
    const [open, setOpen] = useState(false)

    const enableDate = !!props.enableDate
    const enableTime = !!props.enableTime
    if (!(enableDate || enableTime)) return null

    const { date, time } = splitValue(props.value)
    const selected = date ? new Date(`${date}T00:00:00`) : undefined

    const commit = (nextDate: string, nextTime: string) => {
      if (enableDate && enableTime) {
        props.setValue(
          nextDate || nextTime ? `${nextDate}T${nextTime || "00:00"}` : ""
        )
        return
      }
      props.setValue(enableDate ? nextDate : nextTime)
    }

    return (
      <Field>
        {props.label && (
          <FieldLabel htmlFor={enableTime ? id : undefined}>
            {props.label}
          </FieldLabel>
        )}
        <div className="flex items-center gap-2">
          {enableDate && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start font-normal",
                      !date && "text-muted-foreground"
                    )}
                  />
                }
              >
                <CalendarIcon data-icon="inline-start" />
                {selected ? format(selected, "PPP") : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selected}
                  onSelect={(next) => {
                    if (next instanceof Date && !Number.isNaN(next.getTime())) {
                      commit(toIsoDate(next), time)
                      setOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          )}
          {enableTime && (
            <Input
              id={id}
              type="time"
              className={enableDate ? "w-32" : undefined}
              value={time}
              onChange={(e) => commit(date, e.target.value)}
            />
          )}
        </div>
      </Field>
    )
  }
)

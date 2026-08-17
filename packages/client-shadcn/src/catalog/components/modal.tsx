import { useState } from "react"

import { createComponentImplementation } from "@a2ui/react/v0_9"
import { ModalApi } from "@a2ui/web_core/v0_9/basic_catalog"

import { Dialog, DialogContent } from "@/components/ui/dialog"

export const Modal = createComponentImplementation(
  ModalApi,
  ({ props, buildChild }) => {
    const [open, setOpen] = useState(false)

    return (
      <>
        <div className="inline-block" onClick={() => setOpen(true)}>
          {props.trigger ? buildChild(props.trigger) : null}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-auto">
            {props.content ? buildChild(props.content) : null}
          </DialogContent>
        </Dialog>
      </>
    )
  }
)

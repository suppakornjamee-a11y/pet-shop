"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, children, ...props }: React.ComponentProps<"label">) {
  // ถ้าข้อความลงท้ายด้วย "*" (ฟิลด์บังคับ) ให้ไฮไลต์เครื่องหมาย * เป็นสีแดงอัตโนมัติ
  const content =
    typeof children === "string" && /\*\s*$/.test(children) ? (
      <>
        {children.replace(/\s*\*\s*$/, "")} <span className="text-red-600">*</span>
      </>
    ) : (
      children
    )

  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {content}
    </label>
  )
}

export { Label }

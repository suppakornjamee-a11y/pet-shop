"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, children, ...props }: React.ComponentProps<"label">) {
  // ถ้าข้อความลงท้ายด้วย "*" (ฟิลด์บังคับ) ให้ไฮไลต์เครื่องหมาย * เป็นสีแดงอัตโนมัติ
  // รองรับทั้งกรณี children เป็น string ล้วน และกรณีมี icon นำหน้า (children เป็น array)
  const childArray = React.Children.toArray(children)
  const lastChild = childArray[childArray.length - 1]
  const content =
    typeof children === "string" && /\*\s*$/.test(children) ? (
      <>
        {children.replace(/\s*\*\s*$/, "")} <span className="text-red-600">*</span>
      </>
    ) : typeof lastChild === "string" && /\*\s*$/.test(lastChild) ? (
      <>
        {childArray.slice(0, -1)}
        {lastChild.replace(/\s*\*\s*$/, "")} <span className="text-red-600">*</span>
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

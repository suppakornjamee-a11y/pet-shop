"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** ภาพตัวอย่างทรงขนที่ลูกค้าแนบมา — แสดงเป็นรูปย่อ กดแล้วขยายดูในหน้าต่างเดียวกัน */
export function StyleImagesViewer({ images, title }: { images: string[]; title: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <Dialog key={i}>
          <DialogTrigger
            render={
              <button type="button" className="h-20 w-20 overflow-hidden rounded-lg border transition-opacity hover:opacity-80" />
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={title} className="h-full w-full object-cover" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={title} className="max-h-[70vh] w-full rounded-lg border object-contain" />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

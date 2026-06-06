"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Crop, GripVertical, Plus, RotateCcw, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { motion } from "framer-motion";
import NativeImage from "./NativeImage";
import { MAX_PROFILE_PHOTOS } from "@/lib/onboardingProfile.mjs";
import { PHOTO_SLOT_RULES } from "@/lib/photoProcessing.mjs";
import { canDeleteProfilePhoto } from "@/lib/profileEditing.mjs";
import { compactPhotos, movePhoto, removePhotoAt, toPhotoSlots } from "@/lib/profileSettings.mjs";

type PhotoGridEditorProps = {
    photos: (File | string)[];
    setPhotos: (photos: (File | string)[]) => void;
    maxPhotos?: number;
    dense?: boolean;
    verifiedCameraSlots?: boolean[];
};

type CropDraft = {
    file: File;
    slotIndex: number;
    sourceUrl: string;
};

export default function PhotoGridEditor({
    photos,
    setPhotos,
    maxPhotos = MAX_PROFILE_PHOTOS,
    dense = false,
    verifiedCameraSlots = [],
}: PhotoGridEditorProps) {
    const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
    const photoSlots = toPhotoSlots(photos, maxPhotos);

    useEffect(() => {
        return () => {
            if (cropDraft) URL.revokeObjectURL(cropDraft.sourceUrl);
        };
    }, [cropDraft]);

    const startCrop = (file: File, slotIndex: number) => {
        if (cropDraft) URL.revokeObjectURL(cropDraft.sourceUrl);
        setCropDraft({
            file,
            slotIndex,
            sourceUrl: URL.createObjectURL(file),
        });
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    const closeCrop = () => {
        if (cropDraft) URL.revokeObjectURL(cropDraft.sourceUrl);
        setCropDraft(null);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    const applyCrop = async () => {
        if (!cropDraft) return;

        const image = new Image();
        image.src = cropDraft.sourceUrl;
        await image.decode();

        const outputWidth = 800;
        const outputHeight = 1000;
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.fillStyle = "#111111";
        context.fillRect(0, 0, outputWidth, outputHeight);

        const baseScale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight);
        const scale = baseScale * zoom;
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const frame = frameRef.current?.getBoundingClientRect();
        const offsetScaleX = frame ? outputWidth / frame.width : 1;
        const offsetScaleY = frame ? outputHeight / frame.height : 1;
        const drawX = (outputWidth - drawWidth) / 2 + offset.x * offsetScaleX;
        const drawY = (outputHeight - drawHeight) / 2 + offset.y * offsetScaleY;

        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.92);
        });
        if (!blob) return;

        const croppedFile = new File(
            [blob],
            cropDraft.file.name.replace(/\.[^.]+$/, "") + "-profile.jpg",
            { type: "image/jpeg" },
        );
        const nextPhotos = compactPhotos(photos, maxPhotos);
        if (cropDraft.slotIndex < nextPhotos.length) {
            nextPhotos[cropDraft.slotIndex] = croppedFile;
        } else {
            nextPhotos.push(croppedFile);
        }
        setPhotos(nextPhotos);
        closeCrop();
    };

    const removePhoto = (slotIndex: number) => {
        if (!canDeleteProfilePhoto(photos)) {
            window.alert("Keep at least two profile photos.");
            return;
        }
        setPhotos(removePhotoAt(photos, slotIndex, maxPhotos));
    };

    const reorderPhoto = (targetIndex: number) => {
        if (draggingIndex === null) return;
        setPhotos(movePhoto(photos, draggingIndex, targetIndex, maxPhotos));
        setDraggingIndex(null);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        setOffset({
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
        });
    };

    return (
        <>
            <div className={`grid grid-cols-3 ${dense ? "gap-2" : "gap-3"}`}>
                {photoSlots.map((photo, index) => {
                    const slotRule = PHOTO_SLOT_RULES[index] ?? {
                        label: `Slot ${index + 1}`,
                        description: "Add a profile photo.",
                    };
                    const isCameraVerified = Boolean(verifiedCameraSlots[index]);

                    return (
                        <div
                            key={index}
                            onDragOver={(event) => {
                                if (draggingIndex !== null) event.preventDefault();
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                reorderPhoto(index);
                            }}
                            className={`relative group aspect-[4/5] overflow-hidden border-2 border-dashed border-border/60 bg-muted/40 ${draggingIndex === index ? "opacity-60 ring-2 ring-rose-500/50" : ""} ${dense ? "rounded-2xl" : "rounded-[28px]"}`}
                        >
                            {photo ? (
                                <>
                                    <NativeImage
                                        src={typeof photo === "string" ? photo : URL.createObjectURL(photo)}
                                        alt={`Profile photo ${index + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(index)}
                                        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-lg"
                                        title="Remove photo"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        draggable
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed = "move";
                                            setDraggingIndex(index);
                                        }}
                                        onDragEnd={() => setDraggingIndex(null)}
                                        className="absolute left-2 top-2 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-black/70 text-white shadow-lg active:cursor-grabbing"
                                        title="Drag to reorder photo"
                                        aria-label={`Reorder profile photo ${index + 1}`}
                                    >
                                        <GripVertical className="h-4 w-4" />
                                    </button>
                                    {isCameraVerified && (
                                        <span
                                            aria-label="Camera verified"
                                            title="Camera verified"
                                            className="absolute right-2 top-11 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
                                        >
                                            <ShieldCheck className="h-4 w-4" />
                                        </span>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                                        <span className="block truncate text-[9px] font-black uppercase tracking-widest text-white/90">{slotRule.label}</span>
                                        {!dense && <span className="mt-0.5 block line-clamp-2 text-[9px] font-semibold leading-tight text-white/70">{slotRule.description}</span>}
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
                                    <UploadCloud className="h-6 w-6 opacity-50" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{slotRule.label}</span>
                                    {!dense && <span className="line-clamp-2 text-[9px] font-semibold leading-tight opacity-70">{slotRule.description}</span>}
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 z-10 cursor-pointer opacity-0"
                                aria-label={`Upload profile photo ${index + 1}`}
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.currentTarget.value = "";
                                    if (file) startCrop(file, index);
                                }}
                            />
                            {!photo && (
                                <div className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-sm">
                                    <Plus className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {cropDraft && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-sm rounded-[32px] border border-white/10 bg-background p-5 shadow-2xl"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crop className="h-5 w-5 text-rose-500" />
                                <h3 className="text-lg font-black tracking-tight">Crop Photo</h3>
                            </div>
                            <button
                                type="button"
                                onClick={closeCrop}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
                                title="Cancel crop"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div
                            ref={frameRef}
                            className="relative mx-auto aspect-[4/5] w-full max-w-[280px] touch-none overflow-hidden rounded-[28px] bg-black"
                            onPointerDown={(event) => {
                                dragRef.current = {
                                    pointerId: event.pointerId,
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    originX: offset.x,
                                    originY: offset.y,
                                };
                                event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onPointerMove={onPointerMove}
                            onPointerUp={(event) => {
                                dragRef.current = null;
                                event.currentTarget.releasePointerCapture(event.pointerId);
                            }}
                            onPointerCancel={() => {
                                dragRef.current = null;
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={cropDraft.sourceUrl}
                                alt="Crop preview"
                                className="h-full w-full select-none object-cover"
                                draggable={false}
                                style={{
                                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                    transformOrigin: "center",
                                }}
                            />
                            <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
                            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/30" />
                            <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-white/30" />
                        </div>

                        <div className="mt-4 space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Zoom</label>
                            <input
                                type="range"
                                min="1"
                                max="2.5"
                                step="0.05"
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.target.value))}
                                className="w-full accent-rose-500"
                            />
                            <p className="text-center text-xs font-medium text-muted-foreground">Drag inside the frame to reposition.</p>
                        </div>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setZoom(1);
                                    setOffset({ x: 0, y: 0 });
                                }}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground"
                                title="Reset crop"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={applyCrop}
                                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 font-black text-background"
                            >
                                <Check className="h-4 w-4" />
                                Use Photo
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
}

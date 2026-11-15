
"use client";

import { Camera, Wallet } from "lucide-react";

type PhotoControlsProps = {
  onTakePhoto: () => void;
  onConnectPhantom: () => void;
  walletAddress?: string | null;
  isCapturing?: boolean;
};

export default function PhotoControls({
  onTakePhoto,
  onConnectPhantom,
  walletAddress,
  isCapturing = false,
}: PhotoControlsProps) {
  return (
    <>
      {/* Phantom wallet - top right */}
      <div className="absolute right-5 top-5 z-50">
        <button
          type="button"
          onClick={onConnectPhantom}
          className="flex items-center gap-2 rounded-full
            border border-violet-400/40 bg-violet-600
            px-5 py-3 text-sm font-semibold text-white
            shadow-lg shadow-violet-900/30
            transition-all hover:scale-105
            hover:bg-violet-500 active:scale-95"
        >
          <Wallet size={18} />
          {walletAddress
            ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
            : "Connect Phantom"}
        </button>
      </div>

      {/* Camera shutter - bottom right */}
      <div className="absolute bottom-8 right-6 z-50">
        <button
          type="button"
          onClick={onTakePhoto}
          disabled={isCapturing}
          aria-label="Take Photo"
          className="flex h-20 w-20 items-center
            justify-center rounded-full border-4
            border-white bg-white/20
            shadow-xl backdrop-blur-md
            transition-all hover:scale-110
            active:scale-95 disabled:opacity-50"
        >
          <span className="flex h-14 w-14 items-center
            justify-center rounded-full bg-white">
            <Camera size={28} className="text-slate-900" />
          </span>
        </button>
        <p className="mt-2 text-center text-xs
          font-semibold text-white drop-shadow">
          Take Photo
        </p>
      </div>
    </>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  title: string;
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = images.length;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0) setCurrentIndex(totalSlides - 1);
      else if (index >= totalSlides) setCurrentIndex(0);
      else setCurrentIndex(index);
    },
    [totalSlides]
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext]);

  // Touch handlers for swipe
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  }

  function handleTouchEnd() {
    if (touchStart === null) return;
    const threshold = 50;
    if (touchDelta < -threshold) goNext();
    else if (touchDelta > threshold) goPrev();
    setTouchStart(null);
    setTouchDelta(0);
    setIsDragging(false);
  }

  // Mouse drag handlers
  function handleMouseDown(e: React.MouseEvent) {
    setTouchStart(e.clientX);
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (touchStart === null || !isDragging) return;
    const delta = e.clientX - touchStart;
    setTouchDelta(delta);
  }

  function handleMouseUp() {
    if (touchStart === null) return;
    const threshold = 50;
    if (touchDelta < -threshold) goNext();
    else if (touchDelta > threshold) goPrev();
    setTouchStart(null);
    setTouchDelta(0);
    setIsDragging(false);
  }

  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-gradient-to-br from-sky-100 to-cyan-50 rounded-2xl overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">🏊‍♂️</div>
          <p className="text-sm text-sky-400">Sem fotos disponíveis</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 select-none group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Slides container */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${isDragging ? touchDelta : 0}px))`,
          transitionDuration: isDragging ? "0ms" : "300ms",
        }}
      >
        {images.map((url, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={url}
            alt={`${title} - Foto ${index + 1}`}
            className="w-full h-full object-cover flex-shrink-0"
            draggable={false}
          />
        ))}
      </div>

      {/* Navigation arrows (desktop) */}
      {totalSlides > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110"
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {totalSlides > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                goTo(index);
              }}
              className={`rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? "w-6 h-2 bg-white shadow-md"
                  : "w-2 h-2 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Ir para foto ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {totalSlides > 1 && (
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
          {currentIndex + 1}/{totalSlides}
        </span>
      )}
    </div>
  );
}

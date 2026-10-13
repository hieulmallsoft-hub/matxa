import React, { useEffect, useState } from 'react';

export const AmbientCursorLight: React.FC = () => {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      animationFrameId = requestAnimationFrame(() => {
        setPos({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-500 hidden md:block"
      style={{
        background: `radial-gradient(650px circle at ${pos.x}px ${pos.y}px, rgba(99, 102, 241, 0.04), rgba(6, 182, 212, 0.025), transparent 70%)`,
      }}
    />
  );
};

export default AmbientCursorLight;

import { useEffect, useRef } from "react";
import p5 from "p5";

const HomeAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current || p5InstanceRef.current) return;

    const sketch = (p: p5) => {
      let rulerRotation = 0;
      let yardstickRotation = 0;

      p.setup = () => {
        const canvas = p.createCanvas(400, 300);
        canvas.parent(containerRef.current!);
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont("monospace");
      };

      p.draw = () => {
        p.clear();
        
        // Update rotations
        rulerRotation += 0.02;
        yardstickRotation += 0.015;

        // Draw ruler (top section) - 12 inches
        drawRuler(p, 200, 70, 180, 25, rulerRotation);
        
        // Caption for ruler
        p.fill(140, 160, 92); // military olive
        p.textSize(12);
        p.text("inch by inch life's a cinch", 200, 120);

        // Draw yardstick (bottom section) - 36 inches
        drawYardstick(p, 200, 190, 300, 30, yardstickRotation);
        
        // Caption for yardstick
        p.fill(140, 160, 92);
        p.textSize(12);
        p.text("yard by yard life is hard", 200, 250);
      };

      const drawRuler = (p: p5, x: number, y: number, w: number, h: number, rotation: number) => {
        p.push();
        p.translate(x, y);
        
        // Ruler body
        p.fill(245, 222, 179); // tan/wooden color
        p.stroke(139, 119, 101);
        p.strokeWeight(2);
        p.rect(-w/2, -h/2, w, h, 3);
        
        // Inch marks
        p.stroke(60);
        p.strokeWeight(1);
        const inchWidth = w / 12;
        for (let i = 0; i <= 12; i++) {
          const markX = -w/2 + i * inchWidth;
          const markH = i % 2 === 0 ? h * 0.4 : h * 0.25;
          p.line(markX, -h/2, markX, -h/2 + markH);
        }
        
        // Rotating smiley face
        p.push();
        p.translate(0, 0);
        p.rotate(rotation);
        drawSmileyFace(p, 0, 0, 18);
        p.pop();
        
        p.pop();
      };

      const drawYardstick = (p: p5, x: number, y: number, w: number, h: number, rotation: number) => {
        p.push();
        p.translate(x, y);
        
        // Yardstick body
        p.fill(210, 180, 140); // darker tan
        p.stroke(139, 119, 101);
        p.strokeWeight(2);
        p.rect(-w/2, -h/2, w, h, 3);
        
        // Yard/foot marks
        p.stroke(60);
        p.strokeWeight(1);
        const footWidth = w / 3;
        for (let i = 0; i <= 3; i++) {
          const markX = -w/2 + i * footWidth;
          p.line(markX, -h/2, markX, -h/2 + h * 0.5);
        }
        
        // Inch marks within each foot
        const inchWidth = w / 36;
        for (let i = 0; i <= 36; i++) {
          if (i % 12 !== 0) {
            const markX = -w/2 + i * inchWidth;
            const markH = i % 6 === 0 ? h * 0.35 : h * 0.2;
            p.line(markX, -h/2, markX, -h/2 + markH);
          }
        }
        
        // Rotating frowny face
        p.push();
        p.translate(0, 0);
        p.rotate(rotation);
        drawFrownyFace(p, 0, 0, 20);
        p.pop();
        
        p.pop();
      };

      const drawSmileyFace = (p: p5, x: number, y: number, size: number) => {
        // Face
        p.fill(255, 220, 100);
        p.stroke(180, 150, 50);
        p.strokeWeight(1.5);
        p.circle(x, y, size);
        
        // Eyes
        p.fill(40);
        p.noStroke();
        p.circle(x - size * 0.2, y - size * 0.1, size * 0.15);
        p.circle(x + size * 0.2, y - size * 0.1, size * 0.15);
        
        // Smile
        p.noFill();
        p.stroke(40);
        p.strokeWeight(1.5);
        p.arc(x, y + size * 0.05, size * 0.5, size * 0.35, 0.2, p.PI - 0.2);
      };

      const drawFrownyFace = (p: p5, x: number, y: number, size: number) => {
        // Face
        p.fill(200, 200, 220);
        p.stroke(120, 120, 140);
        p.strokeWeight(1.5);
        p.circle(x, y, size);
        
        // Eyes
        p.fill(40);
        p.noStroke();
        p.circle(x - size * 0.2, y - size * 0.1, size * 0.15);
        p.circle(x + size * 0.2, y - size * 0.1, size * 0.15);
        
        // Frown
        p.noFill();
        p.stroke(40);
        p.strokeWeight(1.5);
        p.arc(x, y + size * 0.3, size * 0.5, size * 0.35, p.PI + 0.2, -0.2);
      };
    };

    p5InstanceRef.current = new p5(sketch);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex justify-center items-center"
      aria-hidden="true"
    />
  );
};

export default HomeAnimation;

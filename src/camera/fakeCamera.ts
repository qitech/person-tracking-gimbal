/** Dev-only synthetic video stream so the UI can be checked without a camera (`?fake`). */
export async function startFakeCamera(video: HTMLVideoElement): Promise<void> {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext('2d')!;
  const draw = (t: number) => {
    const g = ctx.createLinearGradient(0, 0, 1280, 720);
    g.addColorStop(0, '#24323f');
    g.addColorStop(1, '#0d1218');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    const x = 640 + 380 * Math.sin(t / 1600);
    ctx.fillStyle = '#c9a27e';
    ctx.beginPath();
    ctx.arc(x, 220, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b5b7a';
    ctx.fillRect(x - 90, 290, 180, 330);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  video.srcObject = c.captureStream(30);
  video.muted = true;
  await video.play();
}

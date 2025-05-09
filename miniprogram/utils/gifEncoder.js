import GIFEncoder from 'gifencoder';
import { createCanvas } from 'canvas';

const gifEncoder = (width, height) => {
  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
  encoder.setDelay(500); // frame delay in ms
  encoder.setQuality(10); // image quality, 10 is default

  return {
    addFrame: (imageData) => {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      encoder.addFrame(ctx);
    },
    finish: () => {
      encoder.finish();
      return encoder.out.getData(); // returns the GIF binary data
    }
  };
};

export default gifEncoder;
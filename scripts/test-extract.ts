import { extractDesignFromConfigSource } from "../lib/template-design";
const config = {
  version: 1,
  back: [
    { type: "qr", xMm: 10, yMm: 10, sizeMm: 32, dataBinding: "qrData" }
  ],
  front: [
    {
      type: "text",
      xMm: 17.2,
      yMm: 13.6,
      maxWidthMm: 64.3,
      font: {
        color: "#000000",
        family: "Frutiger LT Pro",
        sizePt: 10,
        weight: 700,
        baseline: "hanging"
      },
      binding: "name"
    }
  ]
};
console.log(extractDesignFromConfigSource(config));

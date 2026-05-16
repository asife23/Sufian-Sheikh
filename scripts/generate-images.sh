#!/bin/bash
echo "Generating PWA icons..."
npx --yes sharp-cli@latest -i public/icon.svg -o public/icon-192x192.png resize 192 192
npx --yes sharp-cli@latest -i public/icon.svg -o public/icon-512x512.png resize 512 512
npx --yes sharp-cli@latest -i public/screenshot-desktop.svg -o public/screenshot-desktop.png resize 1280 720
npx --yes sharp-cli@latest -i public/screenshot-mobile.svg -o public/screenshot-mobile.png resize 720 1280
echo "Images generated successfully!"

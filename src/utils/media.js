export function isVideo(path) {
  return /\.(mp4|webm|ogg)$/i.test(path || '');
}

export function art(motif) {
  const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300" aria-hidden="true"><g fill="none" stroke="#d4dfaf" stroke-width="1.5">';
  const shapes = motif === 'eye'
    ? '<path d="M70 150Q250 5 430 150Q250 295 70 150Z"/><circle cx="250" cy="150" r="66"/><circle cx="250" cy="150" r="25" fill="#d4dfaf"/><path d="M250 28V62M250 238V272M112 50L137 80M388 50L363 80M112 250L137 220M388 250L363 220"/><ellipse cx="250" cy="150" rx="198" ry="113" stroke-dasharray="3 9" opacity=".25"/>'
    : motif === 'car'
    ? '<path d="M35 248V84H90V248M100 248V48H160V248M335 248V32H395V248M410 248V109H465V248" opacity=".4"/><path d="M153 230V197L176 164H292L327 197V230Z" fill="#2c3428"/><path d="M182 170L168 193H309L289 170Z"/><circle cx="186" cy="231" r="12" fill="#d4dfaf"/><circle cx="293" cy="231" r="12" fill="#d4dfaf"/><path d="M130 249H351M193 171V192M264 171V192"/><path d="M178 91H291V145H178Z" stroke-dasharray="4 8" opacity=".25"/>'
    : '<path d="M110 260V48H390V260Z" opacity=".4"/><path d="M225 82Q130 100 174 198L203 220V252M225 82Q295 93 270 157L286 181L267 188L260 220H230V250"/><path d="M275 82Q370 100 326 198L297 220V252M275 82Q205 93 230 157L214 181L233 188L240 220H270V250" opacity=".55"/><path d="M250 30V275" stroke-dasharray="3 7"/><path d="M195 132H215M285 132H305"/>';
  return head + shapes + '</g></svg>';
}

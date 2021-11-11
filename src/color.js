const colors = ['#e45629', '#e06c95','#50a14f', '#98c379','#c18401', '#e5c07b','#0184bc', '#61afef','#c636b4', '#c678dd','#0997b3', '#56b6c2'];
let colourIndex = 0;

export function nextColor() {
  const color = colors[colourIndex];
  colourIndex = (colourIndex + 1) % colors.length;
  return color;
}

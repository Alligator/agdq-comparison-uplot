const colors = ['#e45649', '#e06c75','#50a14f', '#98c379','#c18401', '#e5c07b','#0184bc', '#61afef','#a626a4', '#c678dd','#0997b3', '#56b6c2'];
let colourIndex = 0;

export function nextColor() {
  const color = colors[colourIndex];
  colourIndex = (colourIndex + 1) % colors.length;
  return color;
}

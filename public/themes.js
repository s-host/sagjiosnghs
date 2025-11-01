const themeSelect = document.getElementById("theme-select");

function updateSliderFills(color) {
  // Update all sliders' fills based on their current values
  // Include volume, speed, and both progress bars (track and persistent album)
  const sliders = document.querySelectorAll('#volumeSlider, .speed-slider, #progressBar, #albumProgress');
  sliders.forEach(slider => {
    if (slider) {
      const percent = parseFloat(slider.value);
      const min = parseFloat(slider.min) || 0;
      const max = parseFloat(slider.max) || 1;
      const normalizedPercent = ((percent - min) / (max - min)) * 100;
      // If the app exposes getProgressBarColor, use it to keep colors consistent
      const fillColor = (typeof window !== 'undefined' && typeof window.getProgressBarColor === 'function')
        ? window.getProgressBarColor()
        : color;
      slider.style.background = `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${normalizedPercent}%, #444 ${normalizedPercent}%, #444 100%)`;
    }
  });
}

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.classList.add(`theme-${savedTheme}`);
  themeSelect.value = savedTheme;
  
  // Update fills on initial load
  let color = '#3b82f6'; // default blue
  if (savedTheme === 'midnight-blurple') color = '#9b89fd';
  if (savedTheme === 'strawberry-lemonade') color = '#e84c8c';
  if (savedTheme === 'ocean-breeze') color = '#20B2AA';
  if (savedTheme === 'sunset-glow') color = '#FF6347';
  if (savedTheme === 'lavender-dreams') color = '#9370DB';
  updateSliderFills(color);
});

themeSelect.addEventListener("change", (e) => {
  const selectedTheme = e.target.value;

  document.body.className = document.body.className
    .split(" ")
    .filter(cls => !cls.startsWith("theme-"))
    .join(" ");

  document.body.classList.add(`theme-${selectedTheme}`);
  localStorage.setItem("theme", selectedTheme);

  // Update fills immediately after theme change
  let color = '#3b82f6'; // default blue
  if (selectedTheme === 'midnight-blurple') color = '#9b89fd';
  if (selectedTheme === 'strawberry-lemonade') color = '#e84c8c';
  if (selectedTheme === 'ocean-breeze') color = '#20B2AA';
  if (selectedTheme === 'sunset-glow') color = '#FF6347';
  if (selectedTheme === 'lavender-dreams') color = '#9370DB';
  updateSliderFills(color);
});
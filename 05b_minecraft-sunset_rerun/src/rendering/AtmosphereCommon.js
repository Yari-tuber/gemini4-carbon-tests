// Shared GLSL Twilight Atmosphere & Directional Mist Functions
// Tuned so sky colors stay rich & velvety (< 0.90 linear) while ONLY the crisp orange solar disc & sun-road trigger HDR bloom!

export const ATMOSPHERE_GLSL = /* glsl */ `
vec3 evalTwilightSky(vec3 dir, vec3 sunDir) {
  vec3 d = normalize(dir);
  float h = clamp(d.y, 0.0, 1.0);

  // Horizontal azimuth alignment with the sun: +1 toward sun, -1 opposite sun (Belt of Venus)
  vec2 dXZ = length(d.xz) > 0.0001 ? normalize(d.xz) : vec2(0.0, -1.0);
  vec2 sXZ = normalize(sunDir.xz);
  float azim = dot(dXZ, sXZ); // [-1, 1]
  float sunward = clamp(azim * 0.5 + 0.5, 0.0, 1.0);
  float antiSun = clamp(-azim, 0.0, 1.0);

  // 1. Upper sky & zenith: deep twilight indigo-violet visible even in upper third of sunward view!
  vec3 zenithCol = vec3(0.018, 0.020, 0.078);
  vec3 upperViolet = vec3(0.068, 0.038, 0.138);

  // 2. Mid-sky band (h ~ 0.14..0.28): warm rose-magenta & dusky orchid transition
  vec3 midSunRose = vec3(0.32, 0.088, 0.145);
  vec3 midAntiOrchid = vec3(0.115, 0.055, 0.185);
  vec3 midCol = mix(midAntiOrchid, midSunRose, pow(sunward, 1.25));

  // 3. Horizon band (h ~ 0.0..0.12):
  // Sunward: rich molten amber-gold & tangerine (kept < 0.85 so the crisp orange sun stands out boldly!)
  vec3 horSunCol = vec3(0.76, 0.215, 0.038);
  vec3 horSideCol = vec3(0.34, 0.092, 0.145);

  // Anti-solar: Earth's dark slate-violet shadow at h=0 crowned by pink-purple Belt of Venus!
  float venusBand = exp(-pow((h - 0.09) / 0.085, 2.0));
  vec3 earthShadowCol = vec3(0.055, 0.042, 0.118);
  vec3 beltOfVenusCol = vec3(0.38, 0.105, 0.255); // Lush pastel rose-magenta-purple
  vec3 horAntiCol = mix(earthShadowCol, beltOfVenusCol, venusBand);

  vec3 horizonCol = mix(horSideCol, horSunCol, pow(sunward, 1.75));
  horizonCol = mix(horizonCol, horAntiCol, pow(antiSun, 1.2));

  // Smooth 4-stop vertical atmospheric gradient (Horizon -> Rose Mid -> Twilight Violet -> Zenith)
  vec3 sky = mix(horizonCol, midCol, smoothstep(0.0, 0.15, h));
  sky = mix(sky, upperViolet, smoothstep(0.13, 0.34, h));
  sky = mix(sky, zenithCol, smoothstep(0.30, 0.78, h));

  // Extra Belt of Venus pastel pink-lilac glow on anti-solar side
  sky += beltOfVenusCol * venusBand * pow(antiSun, 1.3) * 0.38;

  // Focused, controlled golden-amber atmospheric aureole around the sun (never washing out the disc!)
  float cosTheta = max(dot(d, sunDir), 0.0);
  float wideGlow = pow(cosTheta, 7.0) * exp(-h * 4.5);
  float nearRimGlow = pow(cosTheta, 64.0) * exp(-h * 2.0);
  sky += vec3(0.26, 0.072, 0.012) * wideGlow;
  sky += vec3(0.34, 0.095, 0.015) * nearRimGlow;

  return sky;
}

// Directional + Low-Altitude Valley Mist ("薄雾")
vec3 applySunsetMist(vec3 surfaceColor, vec3 worldPos, vec3 camPos, vec3 sunDir, float seaLevel) {
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 viewDir = dist > 0.001 ? (toFrag / dist) : vec3(0.0, 0.0, -1.0);

  vec3 mistDir = normalize(vec3(viewDir.x, max(viewDir.y * 0.35, 0.022), viewDir.z));
  vec3 aerialColor = evalTwilightSky(mistDir, sunDir);

  // Distance aerial perspective
  float distFog = 1.0 - exp(-pow(max(dist - 18.0, 0.0) * 0.0042, 1.30));

  // Low-lying golden-rose coastal & forest valley mist near sea level (y = 22..40)
  float avgH = max(0.0, (min(worldPos.y, 56.0) + min(camPos.y, 56.0)) * 0.5 - seaLevel);
  float lowLying = exp(-avgH * 0.105) * (1.0 - exp(-dist * 0.0062)) * 0.38;

  float sunAlign = max(dot(viewDir, sunDir), 0.0);
  vec3 valleyMistCol = mix(
    vec3(0.24, 0.11, 0.24),  // Dreamy rose-lavender mist in valley shadows
    vec3(0.82, 0.28, 0.065), // Warm sunlit amber-gold mist toward sun
    pow(sunAlign, 2.2)
  );

  vec3 mixed = mix(surfaceColor, valleyMistCol, clamp(lowLying, 0.0, 0.50));
  mixed = mix(mixed, aerialColor, clamp(distFog, 0.0, 1.0));
  return mixed;
}
`;

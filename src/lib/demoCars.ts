export type Pt = { lat: number; lng: number };

export type DemoCar = {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
};

/** A handful of fake cars circling near the passenger, in Darkhan when GPS is local. */
export function spawnCars(origin: Pt, count = 6): DemoCar[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + 0.35;
    const dist = 0.0045 + (i % 3) * 0.0028;
    return {
      id: `demo-${i}`,
      lat: origin.lat + Math.cos(angle) * dist,
      lng: origin.lng + Math.sin(angle) * dist * 1.35,
      heading: angle + Math.PI / 2,
      speed: 0.00018 + (i % 4) * 0.00005,
    };
  });
}

export function stepCars(cars: DemoCar[], origin: Pt): DemoCar[] {
  return cars.map((c, i) => {
    const turn = i % 2 === 0 ? 0.12 : -0.09;
    let heading = c.heading + turn;
    let lat = c.lat + Math.cos(heading) * c.speed;
    let lng = c.lng + Math.sin(heading) * c.speed * 1.35;
    const dlat = lat - origin.lat;
    const dlng = lng - origin.lng;
    if (dlat * dlat + dlng * dlng > 0.00045) {
      heading = Math.atan2(origin.lng - lng, origin.lat - lat);
      lat = origin.lat + dlat * 0.8;
      lng = origin.lng + dlng * 0.8;
    }
    return { ...c, lat, lng, heading };
  });
}

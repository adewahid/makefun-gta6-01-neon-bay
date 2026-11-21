// Deterministic staged scenes for screenshots: the game renders a fixed
// moment (title, driving, police chase, finale) from a seed, with no input.
import { ROADS } from './config.js';
import { createCar, spawnCop } from './entities.js';
import { MISSIONS } from './missions.js';

export function stageScene(g, shot) {
  const { city, player } = g;
  if (shot === 'start') {
    g.state = 'title';
    g.menuSel = 0;
    return;
  }
  if (shot === 'play') {
    // Mid-drive through Downtown in a Comet, traffic around, mission 1 live.
    g.state = 'playing';
    const car = createCar(1, 1050, 750, 0);
    car.speed = 320;
    player.inCar = car;
    player.onFoot = false;
    player.x = car.x; player.y = car.y;
    g.cars.push(car);
    g.missions.index = 0; g.missions.step = 2;
    g.activeTarget = { ...city.landmarks.chopShop };
    g.cam.x = car.x - g.viewW / 2; g.cam.y = car.y - g.viewH / 2;
    g.timeOfDay = 10.5;
    return;
  }
  if (shot === 'chase') {
    // Two-star chase at dusk: Jax in a Vulture, two interceptors closing in.
    g.state = 'playing';
    const car = createCar(2, 1350, 1050, Math.PI / 2);
    car.speed = 380;
    player.inCar = car;
    player.onFoot = false;
    player.x = car.x; player.y = car.y;
    g.cars.push(car);
    g.wanted = 2;
    for (let i = 0; i < 2; i++) {
      const cop = spawnCop(g.rng, city, player);
      cop.x = car.x - 120 - i * 130;
      cop.y = car.y - 160 + i * 90;
      cop.angle = Math.PI / 2;
      cop.speed = 330;
      g.cops.push(cop);
    }
    g.missions.index = 2; g.missions.step = 1;
    g.missions.timer = 87; g.missions.timerTotal = 150;
    g.activeTarget = { ...city.landmarks.bank };
    g.cam.x = car.x - g.viewW / 2; g.cam.y = car.y - g.viewH / 2;
    g.timeOfDay = 18.8;
    return;
  }
  if (shot === 'end') {
    // Finale: all five jobs done, Jax on foot at the Hideout at night.
    g.state = 'complete';
    g.missions.index = 5;
    g.missions.done = MISSIONS.map((m) => m.id);
    player.money = 7500;
    player.x = city.landmarks.hideout.x;
    player.y = city.landmarks.hideout.y;
    player.onFoot = true;
    player.inCar = null;
    g.cam.x = player.x - g.viewW / 2;
    g.cam.y = player.y - g.viewH / 2;
    g.timeOfDay = 21.5;
    return;
  }
  g.state = 'title';
}

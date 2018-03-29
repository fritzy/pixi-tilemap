
module.exports = function (Pixi) {

  const defaultTileMapOptions = {
    tileWidth: 16,
    tileHeight: 16,
    width: 100,
    height: 100,
    zoom: 2
  };
  class TileMap extends Pixi.Container {

    constructor(parent, options) {

      super();
      this.options = {};
      Object.assign(this.options, defaultTileMapOptions, options)
      this.parent = parent;
      this.parent.addChild(this);
      this.layers = {};

      this.tilesByGroup = {};
      this.tilesByMap = {};
      this.tiles = {};
    }

    getTile(ix, iy) {

      let x = Math.floor((ix - this.position.x) / this.options.tileWidth / this.scale.x);
      let y = Math.floor((iy - this.position.y) / this.options.tileHeight / this.scale.y);
      let cx = x * (this.options.tileWidth * this.scale.x) + this.position.x;
      let cy = y * (this.options.tileHeight * this.scale.y) + this.position.y;
      return { x, y , cx, cy};
    }

    moveTo(x, y) {
    }

    moveBy(x, y) {

      this.position.x += x;
      this.position.y += y;
    }

    setScale(s) {
      this.scale.set(s, s);
    }

    zoom(s, x, y) {

      const worldPos = {x: (x - this.position.x) / this.scale.x, y: (y - this.position.y)/this.scale.y};
      const newScale = {x: this.scale.x + s, y: this.scale.y + s};

      const newScreenPos = {x: (worldPos.x ) * newScale.x + this.position.x, y: (worldPos.y) * newScale.y + this.position.y};

      this.position.x -= (newScreenPos.x-x) ;
      this.position.y -= (newScreenPos.y-y) ;
      this.scale.x = newScale.x;
      this.scale.y = newScale.y;
    }

    addLayer(layer) {

      this.layers[layer.name] = layer;
      this.addChild(layer);
      layer.setToMap(this);
    }

    setTile(layer, frame, x, y) {

      const tile = new Tile(frame, x, y, this.tiles[frame]);
      this.layers[layer].setTile(tile, x, y);
    }

    addResources(frames) {

      for (const name of Object.keys(frames)) {
        const frame = frames[name];
        frame.name = name;
        if (!this.tilesByGroup.hasOwnProperty(frame.group)) {
          this.tilesByGroup[frame.group] = {};
          this.tilesByMap[frame.group] = {};
        }
        if (!this.tilesByGroup[frame.group].hasOwnProperty(frame.set)) {
          this.tilesByGroup[frame.group][frame.set] = {};
          this.tilesByMap[frame.group][frame.set] = {};
        }

        this.tilesByGroup[frame.group][frame.set][name] = frame;
        this.tiles[name] = frame;

        if (frame.map) {
          let nmap = '';
          const imap = frame.map;
          if (imap.length === 4) {
            for (let c of imap) {
              nmap += '?' + c;
            }
            frame.map = nmap;
          }
        }
        this.tilesByMap[frame.group][frame.set][frame.map] = frame;
      }
    }

  }

  const defaultLayerOptions = {
    scale: 1,
    offset: [0, 0]
  };

  class Layer extends Pixi.Container {

    constructor(name, options={}) {

      super();
      this.parent = null;
      this.name = name;
      this.options = {};
      Object.assign(this.options, defaultLayerOptions, options);
      this.tileMap = new Map();
    }

    setToMap(map) {

      this.parent = map;
    }

    setTile(tile, x, y) {

      const coord = `${x}-${y}`;
      if (this.tileMap.has(coord)) {
        this.tileMap.get(coord).destroy();
      }
      this.tileMap.set(coord, tile);
      tile.sprite.position.x = this.parent.options.tileWidth * x;
      tile.sprite.position.y = this.parent.options.tileHeight * y;
      this.addChild(tile.sprite);
      this.updateBySet(x, y, true);
    }

    has(x, y) {

      return this.tileMap.has(`${x}-${y}`);
    }

    isSet(group, set, x, y) {

      const tile = this.tileMap.get(`${x}-${y}`);
      return (tile && group === tile.info.group && set === tile.info.set)
    }

    updateBySet(x, y, force=false) {

      const coord = `${x}-${y}`;
      const tile = this.tileMap.get(coord);
      if (!tile || !tile.info || !tile.info.map) {
        return;
      }
      const set = tile.info.set;
      const group = tile.info.group;
      const keys = Object.keys(this.parent.tilesByMap[tile.info.group][tile.info.set]);
      const n = [
        this.isSet(group, set, x - 1, y - 1),
        this.isSet(group, set, x, y - 1),
        this.isSet(group, set, x + 1, y - 1),
        this.isSet(group, set, x + 1, y),
        this.isSet(group, set, x + 1, y + 1),
        this.isSet(group, set, x, y + 1),
        this.isSet(group, set, x - 1, y + 1),
        this.isSet(group, set, x - 1, y),
      ];

      let updatedNeighbors = false;
      for (const key of keys) {
        const m = key.split('');
        let match = true;
        for (let i = 0; i < 8; i++) {
          if (!(m[i] === '?' || (n[i] && m[i] === '1') || (!n[i] && m[i] === '0'))) {
            match = false;
            break;
          }
        }
        if (match) {
          const newFrame = this.parent.tilesByMap[tile.info.group][tile.info.set][key].name;
          if (newFrame !== tile.frame) {
            tile.reset(newFrame);
            updatedNeighbors = true;
            this.updateNeighbors(x, y);
          }
          break;
        }
      }
      if (force && !updatedNeighbors) {
        this.updateNeighbors(x, y);
      }
    }

    updateNeighbors(x, y) {
      this.updateBySet(x - 1, y - 1);
      this.updateBySet(x, y - 1);
      this.updateBySet(x + 1, y - 1);
      this.updateBySet(x - 1, y);
      this.updateBySet(x + 1, y);
      this.updateBySet(x - 1, y + 1);
      this.updateBySet(x, y + 1);
      this.updateBySet(x + 1, y + 1);
    }
  }


  class AnimatedLayer extends Layer {

    constructor(parent, name, options) {

      super(parent, name, options);
    }
  }


  class TileType {

    constructor(options) {

      Object.assign(this, options);
    }
  }


  class Tile {

    constructor(frame, x, y, info) {

      this.frame = frame;
      this.x = x;
      this.y = y;
      this.info = info;
      this.sprite = new Pixi.Sprite.fromFrame(frame);
    }

    reset(frame) {
      this.frame = frame;
      this.info = this.sprite.parent.parent.tiles[frame];
      this.sprite.texture = Pixi.Texture.fromFrame(frame);
    }

    destroy() {

      this.sprite.destroy();
    }
  }

  class CheckerLayer extends Layer {

    constructor(parent, name, options) {

      super(parent, name, options);
    }
  }

  return {
    Map,
    Layer,
    AnimatedLayer,
    TileType,
    TileMap,
    CheckerLayer
  };
}

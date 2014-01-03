/// <reference path="Core.ts" />
/// <reference path="Algebra.ts" />
/// <reference path="Util.ts" />

module ex {
   export class Overlap {
      constructor(public x: number, public y: number) { }
   }

   export class SceneNode {
      public children: Actor[] = [];
      private engine: Engine;
      private killQueue: Actor[] = [];
      constructor() {
      }

      publish(eventType: string, event: GameEvent) {
         this.children.forEach((actor) => {
            actor.triggerEvent(eventType, event);
         });
      }

      update(engine: Engine, delta: number) {
         var len = 0;
         var start = 0;
         var end = 0;
         var actor;
         for (var i = 0, len = this.children.length; i < len; i++) {
            actor = this.children[i];
            this.children[i].update(engine, delta);
         }

         // Remove actors from scene graph after being killed
         var index = 0;
         for (var j = 0, len = this.killQueue.length; j < len; j++) {
            index = this.children.indexOf(this.killQueue[j]);
            this.children.splice(index, 1);
         }
         this.killQueue.length = 0;
      }

      draw(ctx: CanvasRenderingContext2D, delta: number) {
         var len = 0;
         var start = 0;
         var end = 0;
         var actor;
         for (var i = 0, len = this.children.length; i < len; i++) {
            actor = this.children[i];
            this.children[i].draw(ctx, delta);
         }
      }

      debugDraw(ctx: CanvasRenderingContext2D) {
         this.children.forEach((actor) => {
            actor.debugDraw(ctx);
         })
      }

      addChild(actor: Actor) {
         actor.parent = this;
         this.children.push(actor);
      }

      removeChild(actor: Actor) {
         this.killQueue.push(actor);
      }
   }

   export enum Side {
      NONE,
      TOP,
      BOTTOM,
      LEFT,
      RIGHT
   }

   export class Actor {
      public x: number = 0;
      public y: number = 0;
      private height: number = 0;
      private width: number = 0;
      public rotation: number = 0; // radians
      public rx: number = 0; //radions/sec

      public scale: number = 1;
      public sx: number = 0; //scale/sec

      public dx: number = 0; // pixels/sec
      public dy: number = 0;
      public ax: number = 0; // pixels/sec/sec
      public ay: number = 0;

      public invisible: boolean = false;

      private actionQueue: ex.Internal.Actions.ActionQueue;

      private eventDispatcher: EventDispatcher;

      private sceneNode: SceneNode;

      private logger: Logger = Logger.getInstance();

      public parent: SceneNode = null;

      public fixed = true;
      public preventCollisions = false;

      public frames: { [key: string]: IDrawable; } = {}
      //public animations : {[key : string] : Drawing.Animation;} = {};
      public currentDrawing: IDrawable = null;

      private centerDrawingX = false;
      private centerDrawingY = false;
      //public currentAnimation: Drawing.Animation = null;

      public color: Color;
      constructor(x?: number, y?: number, width?: number, height?: number, color?: Color) {
         this.x = x || 0;
         this.y = y || 0;
         this.width = width || 0;
         this.height = height || 0;
         this.color = color;
         this.actionQueue = new ex.Internal.Actions.ActionQueue(this);
         this.eventDispatcher = new EventDispatcher(this);
         this.sceneNode = new SceneNode();
      }


      public static extend(methods: any): any {
         var subclass = function () {
            this['__super'].apply(this, Array.prototype.slice.call(arguments, 0));
            if (this['init']) {
               this['init'].apply(this, Array.prototype.slice.call(arguments, 0));
            }
         };

         var __extends = function (d, b) {
            for (var p in b)
               if (b.hasOwnProperty(p))
                  d[p] = b[p];
            function __() {
               this.constructor = d;
            }
            __.prototype = b.prototype;
            d.prototype = new __();
         };
         var clazz = this;
         __extends(subclass, clazz);

         for (var method in methods) {
            subclass.prototype[method] = methods[method];
         }
         subclass.prototype["__super"] = clazz;
         subclass.prototype["super"] = clazz.prototype;

         return subclass;
      }

      public kill() {
         if (this.parent) {
            this.parent.removeChild(this);
         } else {
            this.logger.log("Cannot kill actor, it was never added to the Scene", Log.Warn);
         }
      }

      public addChild(actor: Actor) {
         this.sceneNode.addChild(actor);
      }

      public removeChild(actor: Actor) {
         this.sceneNode.removeChild(actor);
      }

      // Play animation in Actor's list
      public setDrawing(key) {

         if (this.currentDrawing != this.frames[<string>key]) {
            this.frames[<string>key].reset();
         }
         this.currentDrawing = this.frames[<string>key];
      }

      public addEventListener(eventName: string, handler: (event?: GameEvent) => void) {
         this.eventDispatcher.subscribe(eventName, handler);
      }

      public triggerEvent(eventName: string, event?: GameEvent) {
         this.eventDispatcher.publish(eventName, event);
      }

      public getCenter(): Vector {
         return new Vector(this.x + this.getWidth() / 2, this.y + this.getHeight() / 2);
      }

      public getWidth() {
         return this.width * this.scale;
      }

      public setWidth(width) {
         this.width = width / this.scale;
      }

      public getHeight() {
         return this.height * this.scale;
      }

      public setHeight(height) {
         this.height = height / this.scale;
      }

      public setCenterDrawing(center: boolean) {
         this.centerDrawingY = true;
         this.centerDrawingX = true;
      }

      public getLeft() {
         return this.x;
      }
      public getRight() {
         return this.x + this.getWidth();
      }
      public getTop() {
         return this.y;
      }
      public getBottom() {
         return this.y + this.getHeight();
      }

      private getOverlap(box: Actor): Overlap {
         var xover = 0;
         var yover = 0;
         if (this.collides(box)) {
            if (this.getLeft() < box.getRight()) {
               xover = box.getRight() - this.getLeft();
            }
            if (box.getLeft() < this.getRight()) {
               var tmp = box.getLeft() - this.getRight();
               if (Math.abs(xover) > Math.abs(tmp)) {
                  xover = tmp;
               }
            }

            if (this.getBottom() > box.getTop()) {
               yover = box.getTop() - this.getBottom();
            }

            if (box.getBottom() > this.getTop()) {
               var tmp = box.getBottom() - this.getTop();
               if (Math.abs(yover) > Math.abs(tmp)) {
                  yover = tmp;
               }
            }

         }
         return new Overlap(xover, yover);
      }

      public contains(x: number, y: number): boolean {
         return (this.x <= x && this.y <= y && this.getBottom() >= y && this.getRight() >= x);
      }

      public collides(box: Actor): Side {
         var w = 0.5 * (this.getWidth() + box.getWidth());
         var h = 0.5 * (this.getHeight() + box.getHeight());

         var dx = (this.x + this.getWidth() / 2.0) - (box.x + box.getWidth() / 2.0);
         var dy = (this.y + this.getHeight() / 2.0) - (box.y + box.getHeight() / 2.0);

         if (Math.abs(dx) < w && Math.abs(dy) < h) {
            // collision detected
            var wy = w * dy;
            var hx = h * dx;

            if (wy > hx) {
               if (wy > -hx) {
                  return Side.TOP;
               } else {
               return Side.LEFT
            }
            } else {
               if (wy > -hx) {
                  return Side.RIGHT;
               } else {
                  return Side.BOTTOM;
               }
            }
         }

         return Side.NONE;
      }

      public within(actor: Actor, distance: number): boolean {
         return Math.sqrt(Math.pow(this.x - actor.x, 2) + Math.pow(this.y - actor.y, 2)) <= distance;
      }

      // Add an animation to Actor's list
      public addDrawing(key: any, drawing: IDrawable) {
         this.frames[<string>key] = drawing;
         if (!this.currentDrawing) {
            this.currentDrawing = drawing;
         }
      }

      // Actions
      public clearActions(): void {
         this.actionQueue.clearActions();
      }

      public moveTo(x: number, y: number, speed: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.MoveTo(this, x, y, speed));
         return this;
      }

      public moveBy(x: number, y: number, time: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.MoveBy(this, x, y, time));
         return this;
      }

      public rotateTo(angleRadians: number, speed: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.RotateTo(this, angleRadians, speed));
         return this;
      }

      public rotateBy(angleRadians: number, time: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.RotateBy(this, angleRadians, time));
         return this;
      }

      public scaleTo(size: number, speed: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.ScaleTo(this, size, speed));
         return this;
      }

      public scaleBy(size: number, time: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.ScaleBy(this, size, time));
         return this;
      }

      public blink(frequency: number, duration: number, blinkTime?: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.Blink(this, frequency, duration, blinkTime));
         return this;
      }

      public delay(seconds: number): Actor {
         this.actionQueue.add(new ex.Internal.Actions.Delay(this, seconds));
         return this;
      }

      public repeat(times?: number): Actor {
         if (!times) {
            this.repeatForever();
            return this;
         }
         this.actionQueue.add(new ex.Internal.Actions.Repeat(this, times, this.actionQueue.getActions()));

         return this;
      }

      public repeatForever(): Actor {
         this.actionQueue.add(new ex.Internal.Actions.RepeatForever(this, this.actionQueue.getActions()));
         return this;
      }


      public update(engine: Engine, delta: number) {
         this.sceneNode.update(engine, delta);
         var eventDispatcher = this.eventDispatcher;

         // Update event dispatcher
         eventDispatcher.update();

         // Update action queue
         this.actionQueue.update(delta);

         // Update placements based on linear algebra
         this.x += this.dx * delta / 1000;
         this.y += this.dy * delta / 1000;

         this.rotation += this.rx * delta / 1000;

         this.scale += this.sx * delta / 1000;

         // Publish collision events
         for (var i = 0; i < engine.currentScene.children.length; i++) {
            var other = engine.currentScene.children[i];
            var side: Side = Side.NONE;
            if (other !== this && !other.preventCollisions &&
               (side = this.collides(other)) !== Side.NONE) {
               var overlap = this.getOverlap(other);
               eventDispatcher.publish(EventType[EventType.Collision], new CollisionEvent(this, other, side));
               if (!this.fixed) {
                  if (Math.abs(overlap.y) < Math.abs(overlap.x)) {
                     this.y += overlap.y;
                     //this.dy = 0;
                     //this.dx += (<Actor>other).dx;
                  } else {
                     this.x += overlap.x;
                     //this.dx = 0;
                     //this.dy += (<Actor>other).dy;
                  }

               }
            }
         }

         // Publish other events
         engine.keys.forEach(function (key) {
            eventDispatcher.publish(InputKey[key], new KeyEvent(this, key));
         });

         // Publish click events
         engine.clicks.forEach((e) => {
            if (this.contains(e.x, e.y)) {
               eventDispatcher.publish(EventType[EventType.Click], new Click(e.x, e.y));
               eventDispatcher.publish(EventType[EventType.MouseDown], new MouseDown(e.x, e.y));
            }
         });

         engine.mouseUp.forEach((e) => {
            if (this.contains(e.x, e.y)) {
               eventDispatcher.publish(EventType[EventType.MouseUp], new MouseUp(e.x, e.y));
            }
         })

      eventDispatcher.publish(EventType[EventType.Update], new UpdateEvent(delta));
      }


      public draw(ctx: CanvasRenderingContext2D, delta: number) {

         ctx.save();
         ctx.translate(this.x, this.y);
         ctx.rotate(this.rotation);
         ctx.scale(this.scale, this.scale);

         this.sceneNode.draw(ctx, delta);

         if (!this.invisible) {
            if (this.currentDrawing) {

               var xDiff = 0;
               var yDiff = 0;
               if (this.centerDrawingX) {
                  xDiff = (this.currentDrawing.width * this.currentDrawing.getScale() - this.width) / 2;
               }

               if (this.centerDrawingY) {
                  yDiff = (this.currentDrawing.height * this.currentDrawing.getScale() - this.height) / 2;
               }

               //var xDiff = (this.currentDrawing.width*this.currentDrawing.getScale() - this.width)/2;
               //var yDiff = (this.currentDrawing.height*this.currentDrawing.getScale() - this.height)/2;
               this.currentDrawing.draw(ctx, -xDiff, -yDiff);

            } else {
               ctx.fillStyle = this.color ? this.color.toString() : (new Color(0, 0, 0)).toString();
               ctx.fillRect(0, 0, this.width, this.height);
            }
         }
         ctx.restore();
      }

      public debugDraw(ctx: CanvasRenderingContext2D) {
         // Meant to draw debug information about actors
         ctx.save();
         ctx.translate(this.x, this.y);


         ctx.scale(this.scale, this.scale);
         // Currently collision primitives cannot rotate 
         // ctx.rotate(this.rotation);

         this.sceneNode.debugDraw(ctx);

         ctx.beginPath();
         ctx.rect(0, 0, this.width, this.height);
         ctx.stroke();

         ctx.restore();
      }
   }

   export class Label extends Actor {
      public text: string;
      public spriteFont: SpriteFont;
      public font: string;
      constructor(text?: string, x?: number, y?: number, font?: string, spriteFont?: SpriteFont) {
         super(x, y);
         this.text = text || "";
         this.color = Color.White;
         this.spriteFont = spriteFont;
         this.fixed = true;
         this.preventCollisions = true;
         this.font = font || "10px sans-serif"; // coallesce to default canvas font
      }

      public update(engine: Engine, delta: number) {
         super.update(engine, delta);
      }

      public draw(ctx: CanvasRenderingContext2D, delta: number) {

         ctx.save();
         ctx.translate(this.x, this.y);
         ctx.scale(this.scale, this.scale);
         ctx.rotate(this.rotation);
         if (!this.invisible) {
            if (this.spriteFont) {
               this.spriteFont.draw(ctx, 0, 0, this.text);
            } else {
               ctx.fillStyle = this.color.toString();
               ctx.font = this.font;
               ctx.fillText(this.text, 0, 0);
            }
         }

         super.draw(ctx, delta);
         ctx.restore();
      }

      public debugDraw(ctx: CanvasRenderingContext2D) {
         super.debugDraw(ctx);
      }

   }


   export class Particle {
      public position: Vector = new Vector(0, 0);
      public velocity: Vector = new Vector(0, 0);
      public acceleration: Vector = new Vector(0, 0);
      public focus: Vector = null;
      public focusAccel: number = 0;
      public opacity: number = 1;
      public particleColor: Color = Color.White;
      // Life is counted in ms
      public life: number = 300;
      public fade: boolean = false;
      private fadeRate: number = 0;
      public emitter: ParticleEmitter = null;
      public particleSize: number = 5;

      constructor(emitter: ParticleEmitter, life?: number, position?: Vector, velocity?: Vector, acceleration?: Vector) {
         this.emitter = emitter;
         this.life = life || this.life;
         this.position = position || this.position;
         this.velocity = velocity || this.velocity;
         this.acceleration = acceleration || this.acceleration;
         this.fadeRate = this.opacity / this.life;
      }

      public kill() {
         this.emitter.removeParticle(this);
      }

      public update(delta: number) {
         this.life = this.life - delta;
         if (this.fade) {
            this.opacity -= this.fadeRate * delta / 2;

         }
         if (this.life < 0) {
            this.kill();
         }
         if (this.focus) {
            var accel = this.focus.minus(this.position).normalize().scale(this.focusAccel).scale(delta / 1000);
            this.velocity = this.velocity.add(accel);
         } else {
            this.velocity = this.velocity.add(this.acceleration.scale(delta / 1000));
         }
         this.position = this.position.add(this.velocity.scale(delta/1000));
      }

      public draw(ctx: CanvasRenderingContext2D) {
         this.particleColor.a = (this.opacity < 0 ? 0.01: this.opacity);
         ctx.fillStyle = this.particleColor.toString();
         ctx.beginPath();
         ctx.arc(this.position.x, this.position.y, this.particleSize, 0, Math.PI * 2);
         ctx.fill();
         ctx.closePath();
      }
   }

   export class ParticleEmitter extends Actor {

      public numParticles: number = 0;
      public isEmitting: boolean = false;
      public particles: Util.Collection<Particle> = null;
      public deadParticles: Util.Collection<Particle> = null;

      public minVel: number = 0;
      public maxVel: number = 0;
      public acceleration: Vector = new Vector(0, 0);
      public minAngle: number = 0;
      public maxAngle: number = 0;
      public emitRate: number = 1; //particles/sec
      public particleLife: number = 2000;
      public opacity: number = 1;
      public fade: boolean = false;
      public focus: Vector = null;
      public focusAccel: number = 1;
      public minSize: number = 5;
      public maxSize: number = 5;
      public particleColor: Color = Color.White;

      constructor(x?: number, y?: number, width?: number, height?: number) {    
         super(x, y, width, height, Color.White);
         this.preventCollisions = true;
         this.particles = new Util.Collection<Particle>();
         this.deadParticles = new Util.Collection<Particle>();
      }

      public removeParticle(particle: Particle) {
         this.deadParticles.push(particle);
      }

      // Causes the emitter to emit particles
      public emit(particleCount: number) {
         for (var i = 0; i < particleCount; i++) {
            this.particles.push(this.createParticle());
         }
      }

      public clearParticles() {
         this.particles.clear();
      }

      // Creates a new particle given the contraints of the emitter
      private createParticle(): Particle {
         // todo implement emitter contraints;
         var ranX = Util.randomInRange(this.x, this.x + this.getWidth());
         var ranY = Util.randomInRange(this.y, this.y + this.getHeight());

         var angle = Util.randomInRange(this.minAngle, this.maxAngle);
         var vel = Util.randomInRange(this.minVel, this.maxVel);
         var size = Util.randomInRange(this.minSize, this.maxSize);
         var dx = vel * Math.cos(angle);
         var dy = vel * Math.sin(angle);
         
         var p = new Particle(this, this.particleLife, new Vector(ranX, ranY), new Vector(dx, dy), this.acceleration);
         p.opacity = this.opacity;
         p.fade = this.fade;
         p.particleSize = size;
         p.particleColor = this.particleColor;
         if (this.focus) {
            p.focus = this.focus.add(new ex.Vector(this.x, this.y));
            p.focusAccel = this.focusAccel;
         }
         return p;
      }
      
      public update(engine: Engine, delta: number) {
         super.update(engine, delta);
         if (this.isEmitting) {
            var numParticles = Math.ceil(this.emitRate * delta / 1000);
            this.emit(numParticles);
         }

         this.particles.forEach((particle: Particle, index: number) => {
            particle.update(delta);
         });

         this.deadParticles.forEach((particle: Particle, index: number) => {
            this.particles.removeElement(particle);
         });
         this.deadParticles.clear();
      }

      public draw(ctx: CanvasRenderingContext2D, delta: number) {
         this.particles.forEach((particle: Particle, index: number) => {
            // todo is there a more efficient to draw 
            // possibly use a webgl offscreen canvas and shaders to do particles?
            particle.draw(ctx);
         });
      }

      public debugDraw(ctx: CanvasRenderingContext2D) {
         super.debugDraw(ctx);
         ctx.fillStyle = 'yellow';
         ctx.fillText("Particles: " + this.particles.count(), this.x, this.y + 20);

         if (this.focus) {
            ctx.fillRect(this.focus.x + this.x, this.focus.y + this.y, 3, 3);
            Util.drawLine(ctx, "yellow", this.focus.x + this.x, this.focus.y + this.y, super.getCenter().x, super.getCenter().y);
            ctx.fillText("Focus", this.focus.x + this.x, this.focus.y + this.y);
         }
      }

   }
}
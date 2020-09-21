/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @copyright    2020 Photon Storm Ltd.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var AnimationState = require('../../animations/AnimationState');
var Class = require('../../utils/Class');
var Components = require('../../gameobjects/components');
var Face = require('./Face');
var Matrix4 = require('../../math/Matrix4');
var Quaternion = require('../../math/Quaternion');
var RGB = require('../../display/RGB');
var Vector3 = require('../../math/Vector3');
var Vertex = require('./Vertex');

/**
 * @classdesc
 * A Model Game Object.
 *
 * @class Model
 * @memberof Phaser.Geom.Mesh
 * @constructor
 * @since 3.50.0
 */
var Model = new Class({

    Mixins: [
        Components.AlphaSingle,
        Components.Size,
        Components.Texture,
        Components.Visible
    ],

    initialize:

    function Model (mesh, verticesCount, texture, frame, x, y, z)
    {
        if (x === undefined) { x = 0; }
        if (y === undefined) { y = 0; }
        if (z === undefined) { z = 0; }

        this.mesh = mesh;

        this.scene = mesh.scene;

        /**
         * The Animation State of this Mesh.
         *
         * @name Phaser.GameObjects.Mesh#anims
         * @type {Phaser.Animation.AnimationState}
         * @since 3.50.0
         */
        this.anims = new AnimationState(this);

        this.vertexSize = 32; // 8 attributes * bytes size
        this.vertexCount = 0; // current number of vertices added to the buffer
        this.vertexData = new ArrayBuffer(verticesCount * this.vertexSize);
        this.vertexViewF32 = new Float32Array(this.vertexData);

        this.position = new Vector3(x, y, z);
        this.scale = new Vector3(1, 1, 1);
        this.rotation = new Quaternion();

        //  cache structure = position | rotation | scale | verts count
        this.dirtyCache = [ x, y, z, 0, 0, 0, 1, 1, 1, 1, 0 ];

        this.ambient = new RGB(1, 1, 1);
        this.diffuse = new RGB(1, 1, 1);
        this.specular = new RGB(1, 1, 1);
        this.shine = 0.25;

        this.normalMatrix = new Matrix4();
        this.transformMatrix = new Matrix4();

        if (!texture)
        {
            texture = this.scene.sys.textures.get('__WHITE');
        }

        this.setTexture(texture, frame);

        this.setSizeToFrame();
    },

    emit: function ()
    {
        this.mesh.emit.call(arguments);
    },

    isDirty: function ()
    {
        var position = this.position;
        var rotation = this.rotation;
        var scale = this.scale;

        var dirtyCache = this.dirtyCache;

        var px = position.x;
        var py = position.y;
        var pz = position.z;

        var rx = rotation.x;
        var ry = rotation.y;
        var rz = rotation.z;
        var rw = rotation.w;

        var sx = scale.x;
        var sy = scale.y;
        var sz = scale.z;

        var vertices = this.vertexCount;

        var pxCached = dirtyCache[0];
        var pyCached = dirtyCache[1];
        var pzCached = dirtyCache[2];

        var rxCached = dirtyCache[3];
        var ryCached = dirtyCache[4];
        var rzCached = dirtyCache[5];
        var rwCached = dirtyCache[6];

        var sxCached = dirtyCache[7];
        var syCached = dirtyCache[8];
        var szCached = dirtyCache[9];

        var vCached = dirtyCache[10];

        dirtyCache[0] = px;
        dirtyCache[1] = py;
        dirtyCache[2] = pz;

        dirtyCache[3] = rx;
        dirtyCache[4] = ry;
        dirtyCache[5] = rz;
        dirtyCache[6] = rw;

        dirtyCache[7] = sx;
        dirtyCache[8] = sy;
        dirtyCache[9] = sz;

        dirtyCache[10] = vertices;

        return (
            pxCached !== px || pyCached !== py || pzCached !== pz ||
            rxCached !== rx || ryCached !== ry || rzCached !== rz || rwCached !== rw ||
            sxCached !== sx || syCached !== sy || szCached !== sz ||
            vCached !== vertices
        );
    },

    preUpdate: function (time, delta)
    {
        this.anims.update(time, delta);

        //  If the model isn't dirty we can bail out and save lots of math
        if (this.isDirty())
        {
            var normalMatrix = this.normalMatrix;
            var transformMatrix = this.transformMatrix;

            //  TODO - Merge scale into this op
            transformMatrix.fromRotationTranslation(this.rotation, this.position);
            transformMatrix.scale(this.scale);

            normalMatrix.copy(transformMatrix);
            normalMatrix.invert();
            normalMatrix.transpose();
        }
    },

    /**
     * Returns the total number of Faces in this Model.
     *
     * @method Phaser.Geom.Mesh.Model#getFaceCount
     * @since 3.50.0
     *
     * @return {number} The number of Faces in this Model.
     */
    getFaceCount: function ()
    {
        return this.vertexCount / 3;
    },

    /**
     * Gets the Vertex at the given offset from this models data.
     *
     * Be aware that the returned Vertex is untranslated, so will need transforming if you wish
     * to use its coordinates in world space.
     *
     * @method Phaser.Geom.Mesh.Model#getVertex
     * @since 3.50.0
     *
     * @param {number} index - The index of the vertex to get. Cannot be negative, or exceed `Model.vertexCount`.
     *
     * @return {Phaser.Types.GameObjects.Vertex} A Vertex object.
     */
    getVertex: function (index)
    {
        var vertexViewF32 = this.vertexViewF32;

        //  8 = attribute count (number of items added into the view below)
        var vertexOffset = (index * 8) - 1;

        var x = vertexViewF32[++vertexOffset];
        var y = vertexViewF32[++vertexOffset];
        var z = vertexViewF32[++vertexOffset];
        var normalX = vertexViewF32[++vertexOffset];
        var normalY = vertexViewF32[++vertexOffset];
        var normalZ = vertexViewF32[++vertexOffset];
        var u = vertexViewF32[++vertexOffset];
        var v = vertexViewF32[++vertexOffset];

        return { x: x, y: y, z: z, u: u, v: v, normalX: normalX, normalY: normalY, normalZ: normalZ, alpha: 1 };
    },

    /**
     * Returns the Face at the given index in this Model.
     *
     * A face comprises of 3 vertices.
     *
     * @method Phaser.Geom.Mesh.Model#getFace
     * @since 3.50.0
     *
     * @param {number} index - The index of the Face to get.
     *
     * @return {Phaser.Types.GameObjects.Face} The Face at the given index, or `undefined` if index out of range.
     */
    getFace: function (index)
    {
        var offset = index * 3;

        var v1 = this.getVertex(offset);
        var v2 = this.getVertex(offset + 1);
        var v3 = this.getVertex(offset + 2);
        var ccw = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x) >= 0;

        return { vertex1: v1, vertex2: v2, vertex3: 3, isCounterClockwise: ccw };
    },

    /**
     * Adds a new Vertex into the vertices array of this Mesh.
     *
     * Just adding a vertex isn't enough to render it. You need to also
     * make it part of a Face, with 3 Vertex instances per Face.
     *
     * @method Phaser.Geom.Mesh.Model#addVertex
     * @since 3.50.0
     *
     * @param {number} x - The x position of the vertex.
     * @param {number} y - The y position of the vertex.
     * @param {number} z - The z position of the vertex.
     * @param {number} u - The UV u coordinate of the vertex.
     * @param {number} v - The UV v coordinate of the vertex.
     * @param {number} normalX - The x normal of the vertex.
     * @param {number} normalY - The y normal of the vertex.
     * @param {number} normalZ - The z normal of the vertex.
     *
     * @return {this} This Mesh Game Object.
     */
    addVertex: function (x, y, z, u, v, normalX, normalY, normalZ)
    {
        var vertexViewF32 = this.vertexViewF32;

        //  8 = attribute count (number of items added into the view below)
        var vertexOffset = (this.vertexCount * 8) - 1;

        vertexViewF32[++vertexOffset] = x;
        vertexViewF32[++vertexOffset] = y;
        vertexViewF32[++vertexOffset] = z;
        vertexViewF32[++vertexOffset] = normalX;
        vertexViewF32[++vertexOffset] = normalY;
        vertexViewF32[++vertexOffset] = normalZ;
        vertexViewF32[++vertexOffset] = u;
        vertexViewF32[++vertexOffset] = v;

        this.vertexCount++;
    },

    /**
     * Adds new vertices to this Model by parsing the given arrays.
     *
     * The `vertices` parameter is a numeric array consisting of `x` and `y` pairs.
     * The `uvs` parameter is a numeric array consisting of `u` and `v` pairs.
     * The `indicies` parameter is an optional array that, if given, is an indexed list of vertices to be added.
     *
     * The following example will create a 256 x 256 sized quad using an index array:
     *
     * ```javascript
     * const vertices = [
     *   -128, 128,
     *   128, 128,
     *   -128, -128,
     *   128, -128
     * ];
     *
     * const uvs = [
     *   0, 1,
     *   1, 1,
     *   0, 0,
     *   1, 0
     * ];
     *
     * const indices = [ 0, 2, 1, 2, 3, 1 ];
     *
     * Mesh.addVertices(vertices, uvs, indicies);
     * ```
     *
     * Vertices must be provided as x/y pairs, there is no `z` component used in this call. For that, please see
     * `addModel` instead.
     *
     * @method Phaser.GameObjects.Mesh#addVertices
     * @since 3.50.0
     *
     * @param {number[]} vertices - The vertices array.
     * @param {number[]} uvs - The UVs array.
     * @param {number[]} [indicies] - Optional vertex indicies array.
     * @param {number|number[]} [colors=0xffffff] - An array of colors, one per vertex, or a single color value applied to all vertices.
     * @param {number|number[]} [alphas=1] - An array of alpha values, one per vertex, or a single alpha value applied to all vertices.
     *
     * @return {this} This Mesh Game Object.
     */
    addVertices: function (vertices, uvs, indicies, colors, alphas)
    {
        if (colors === undefined) { colors = 0xffffff; }
        if (alphas === undefined) { alphas = 1; }

        if (vertices.length !== uvs.length)
        {
            throw new Error('Mesh - vertices and uv count not equal');
        }

        var i;
        var vert;
        var verts = this.vertices;
        var faces = this.faces;

        var isColorArray = Array.isArray(colors);
        var isAlphaArray = Array.isArray(alphas);

        if (Array.isArray(indicies) && indicies.length > 0)
        {
            for (i = 0; i < indicies.length; i++)
            {
                var index = indicies[i] * 2;

                vert = new Vertex(
                    vertices[index],
                    vertices[index + 1],
                    0,
                    uvs[index],
                    uvs[index + 1],
                    (isColorArray) ? colors[i] : colors,
                    (isAlphaArray) ? alphas[i] : alphas
                );

                verts.push(vert);
            }
        }
        else
        {
            var colorIndex = 0;

            for (i = 0; i < vertices.length; i += 2)
            {
                vert = new Vertex(
                    vertices[i],
                    vertices[i + 1],
                    0,
                    uvs[i],
                    uvs[i + 1],
                    (isColorArray) ? colors[colorIndex] : colors,
                    (isAlphaArray) ? alphas[colorIndex] : alphas
                );

                verts.push(vert);

                colorIndex++;
            }
        }

        for (i = 0; i < verts.length; i += 3)
        {
            var vert1 = verts[i];
            var vert2 = verts[i + 1];
            var vert3 = verts[i + 2];

            var face = new Face(vert1, vert2, vert3);

            faces.push(face);
        }

        return this;
    },

    /**
     * Rotates this model along the x axis by the given amount.
     *
     * This method works by calling the `rotateX` method of the `rotation` quaternion of this model.
     *
     * @method Phaser.Geom.Mesh.Model#rotateX
     * @since 3.50.0
     *
     * @param {number} rad - The amount, in radians, to rotate the Model by.
     *
     * @return {this} This Mesh Game Object.
     */
    rotateX: function (rad)
    {
        this.rotation.rotateX(rad);

        return this;
    },

    /**
     * Rotates this model along the y axis by the given amount.
     *
     * This method works by calling the `rotateY` method of the `rotation` quaternion of this model.
     *
     * @method Phaser.Geom.Mesh.Model#rotateY
     * @since 3.50.0
     *
     * @param {number} rad - The amount, in radians, to rotate the Model by.
     *
     * @return {this} This Mesh Game Object.
     */
    rotateY: function (rad)
    {
        this.rotation.rotateY(rad);

        return this;
    },

    /**
     * Rotates this model along the z axis by the given amount.
     *
     * This method works by calling the `rotateZ` method of the `rotation` quaternion of this model.
     *
     * @method Phaser.Geom.Mesh.Model#rotateZ
     * @since 3.50.0
     *
     * @param {number} rad - The amount, in radians, to rotate the Model by.
     *
     * @return {this} This Mesh Game Object.
     */
    rotateZ: function (rad)
    {
        this.rotation.rotateZ(rad);

        return this;
    },

    /**
     * The x position of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#x
     * @type {number}
     * @since 3.50.0
     */
    x: {

        get: function ()
        {
            return this.position.x;
        },

        set: function (value)
        {
            this.position.x = value;
        }

    },

    /**
     * The y position of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#y
     * @type {number}
     * @since 3.50.0
     */
    y: {

        get: function ()
        {
            return this.position.y;
        },

        set: function (value)
        {
            this.position.y = value;
        }

    },

    /**
     * The z position of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#z
     * @type {number}
     * @since 3.50.0
     */
    z: {

        get: function ()
        {
            return this.position.z;
        },

        set: function (value)
        {
            this.position.z = value;
        }

    },

    /**
     * The x scale of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#scaleX
     * @type {number}
     * @since 3.50.0
     */
    scaleX: {

        get: function ()
        {
            return this.scale.x;
        },

        set: function (value)
        {
            this.scale.x = value;
        }

    },

    /**
     * The y scale of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#scaleY
     * @type {number}
     * @since 3.50.0
     */
    scaleY: {

        get: function ()
        {
            return this.scale.y;
        },

        set: function (value)
        {
            this.scale.y = value;
        }

    },

    /**
     * The z scale of this model in 3D space.
     *
     * @name Phaser.Geom.Mesh.Face#scaleZ
     * @type {number}
     * @since 3.50.0
     */
    scaleZ: {

        get: function ()
        {
            return this.scale.z;
        },

        set: function (value)
        {
            this.scale.z = value;
        }

    },

    /**
     * Destroys this Model, all of vertex data and references.
     *
     * @method Phaser.Geom.Mesh.Model#destroy
     * @since 3.50.0
     */
    destroy: function ()
    {
        this.anims.destroy();

        this.mesh = null;
        this.scene = null;
        this.anims = null;

        this.vertexData = null;
        this.vertexViewF32 = null;

        this.position = null;
        this.scale = null;
        this.rotation = null;

        this.ambient = null;
        this.diffuse = null;
        this.specular = null;

        this.normalMatrix = null;
        this.transformMatrix = null;
    }

});

module.exports = Model;

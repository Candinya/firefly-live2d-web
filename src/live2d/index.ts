import { FacePoint } from './face-point';
import { Live2dRenderer } from './renderer';
import { getAngle, getDistance } from './math-util';

const CUBISM_CORE_URL = './live2dcubismcore.min.js';

const MODEL_PATH = './Firefly/';
const MODEL_FILES = {
	moc3: MODEL_PATH + 'Firefly.moc3',
	model3: MODEL_PATH + 'Firefly.model3.json',
	physics3: MODEL_PATH + 'Firefly.physics3.json',
	textures: [
		MODEL_PATH + 'Firefly.8192/texture_00.png',
		MODEL_PATH + 'Firefly.8192/texture_01.png'
	],
	expressions: {
	},
	motions: {
	},
};

let isCoreSdkLoaded = false;

export function load(canvas: HTMLCanvasElement, options: { x: number; y: number; scale: number; eyeX?: number; eyeY?: number; }): Promise<Live2dRenderer | undefined> {
	return new Promise((res, rej) => {
		const existedCoreSdkScript = document.head.querySelector(`script[src="${CUBISM_CORE_URL}"]`);
		if (existedCoreSdkScript) {
			if (!isCoreSdkLoaded) {
				existedCoreSdkScript.addEventListener('load', () => {
					main(canvas, options).then(renderer => {
						res(renderer);
					});
				});
			} else {
				main(canvas, options).then(renderer => {
					res(renderer);
				});
			}
		} else {
			const coreSdkScript = document.createElement('script');
			coreSdkScript.setAttribute('src', CUBISM_CORE_URL);
			document.head.appendChild(coreSdkScript);
			coreSdkScript.addEventListener('load', () => {
				isCoreSdkLoaded = true;
				main(canvas, options).then(renderer => {
					res(renderer);
				});
			});
		}
	});
}

async function main(canvas: HTMLCanvasElement, options: { x: number; y: number; scale: number; eyeX?: number; eyeY?: number; }) {
	try {
		const [model, moc3, physics, textures, expressions, motions] = await Promise.all([
			fetch(MODEL_FILES.model3).then(res => res.arrayBuffer()),
			fetch(MODEL_FILES.moc3).then(res => res.arrayBuffer()),
			fetch(MODEL_FILES.physics3).then(res => res.arrayBuffer()),
			Promise.all(MODEL_FILES.textures.map(texture =>
				fetch(texture).then(res => res.blob())
			)),
			Promise.all(Object.entries(MODEL_FILES.expressions).map(([k, v]) =>
				fetch(v).then(res => res.arrayBuffer()).then(buffer => [k, buffer] as [string, ArrayBuffer])
			)),
			Promise.all(Object.entries(MODEL_FILES.motions).map(([k, v]) =>
				fetch(v).then(res => res.arrayBuffer()).then(buffer => [k, buffer] as [string, ArrayBuffer])
			)),
		]);
		const renderer = new Live2dRenderer(canvas);
		await renderer.init(model, {
			moc3,
			physics,
			textures,
			expressions,
			motions,
		}, {
			autoBlink: true,
			...options
		});

		window.parent.postMessage({
			type: 'loaded',
			body: null,
		}, '*');

		const point = new FacePoint();
		const _handleOnMouseMove = (e: {
			x: number;
			y: number;
		}) => {
			const cursorX = e.x;
			const cursorY = e.y;
			const rect = canvas.getBoundingClientRect();

			// モデルの目の位置
			// 指定されていない場合、とりあえず目は画像の真ん中あたりにあると仮定する
			// TODO: 自動でモデルの目の位置を取得し、指定の必要を無くす(出来るか不明)
			const eyeX = options.eyeX ? options.eyeX : rect.left + (rect.width / 2);
			const eyeY = options.eyeY ? options.eyeY : rect.top + (rect.height / 2);

			// TODO: ここら辺マジックナンバー多いのでなんとかしたい
			const angle = getAngle(cursorX, cursorY, eyeX, eyeY);
			const r = Math.cos(angle) * Math.sin(angle) * 180 / Math.PI;
			const distance = getDistance(cursorX, cursorY, eyeX, eyeY);
			const dx = eyeX - cursorX;
			const dy = eyeY - cursorY;
			Object.assign(point, {
				angleX: -dx / 10,
				angleY: dy / 10,
				angleZ: r * (distance / eyeX) / 10,
				angleEyeX: -dx / eyeX / 10,
				angleEyeY: dy / eyeY / 2,
			});
			renderer.updatePoint(point);
		};

		document.body.addEventListener('mousemove', ev => {
			_handleOnMouseMove({
				x: ev.clientX,
				y: ev.clientY
			});
		}, false);

		window.addEventListener('message', message => {
			const { type, body } = message.data;
			switch (type) {
				case 'setPos':
					
					break;

				case 'moveCursor':
					_handleOnMouseMove(body);
					break;
			
				default:
					break;
			}
		}, false);

		return renderer;
	} catch(e) {
		alert(e.message);
		console.error(e);
	}
}

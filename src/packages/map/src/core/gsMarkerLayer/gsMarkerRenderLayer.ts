import type { IconLayerProps } from 'deck.gl'
import type { GSMarkerInfo } from '../../types'
import { IconLayer } from 'deck.gl'
import fs from './gsMarkerRenderLayer.fs.glsl?raw'

export interface MarkerRenderLayerProps extends IconLayerProps<GSMarkerInfo> {
  getIconFlag: (id: GSMarkerInfo) => number
  statusCount: number
}

export class GSMarkerRenderLayer extends IconLayer<GSMarkerInfo, MarkerRenderLayerProps> {
  static layerName = 'GSMarkerRenderLayer'

  static defaultProps = Object.assign(
    {
      getIconFlag: { type: 'accessor', value: 0 },
    },
    IconLayer.defaultProps,
  )

  declare state: IconLayer['state'] & {
    finished?: boolean
  }

  initializeState = () => {
    super.initializeState()

    const attributeManager = this.getAttributeManager()!

    attributeManager.addInstanced({
      instanceAttachFlags: {
        size: 1,
        type: 'uint16',
        accessor: 'getIconFlag',
        defaultValue: 0,
      },
    })
  }

  getShaders = () => {
    const shader = {
      ...super.getShaders(),
      fs,
      inject: {
        'vs:#decl': /* glsl */ `
          in uint instanceAttachFlags;
          out vec3 vAttachCoords[${this.props.statusCount}];
        `,
        'vs:#main-end': /* glsl */ `
          for (int i = 0; i < 5; ++i) {
            float alpha = float((instanceAttachFlags >> i) & 1u);
            float x = float(i) * iconSize.x;
            vec2 rawCoord = vec2(x, 0.0);
            vec2 coord = mix(
              rawCoord,
              rawCoord + iconSize,
              (positions.xy + 1.0) / 2.0
            ) / icon.iconsTextureDim;
            vAttachCoords[i] = vec3(coord, alpha);
          }
        `,
      },
    }
    return shader
  }
}

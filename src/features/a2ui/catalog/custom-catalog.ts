import { standardCatalog } from '@a2ui-sdk/react/0.8'
import type { Catalog } from '@a2ui-sdk/react/0.8'
import { TextAdapter } from './adapters/text'
import { ButtonAdapter } from './adapters/button'
import { CardAdapter } from './adapters/card'
import { InputAdapter } from './adapters/input'
import { ImageAdapter } from './adapters/image'
import { RowAdapter } from './adapters/row'
import { ColumnAdapter } from './adapters/column'
import { ListAdapter } from './adapters/list'
import { DividerAdapter } from './adapters/divider'
import { CodeBlockAdapter } from './adapters/code'
import { CheckBoxAdapter } from './adapters/checkbox'
import { MultipleChoiceAdapter } from './adapters/multiple-choice'
import { SliderAdapter } from './adapters/slider'
import { DateTimeInputAdapter } from './adapters/datetime'
import { IconAdapter } from './adapters/icon'
import { VideoAdapter } from './adapters/video'
import { AudioPlayerAdapter } from './adapters/audio-player'
import { TabsAdapter } from './adapters/tabs'
import { ModalAdapter } from './adapters/modal'

export const customCatalog: Catalog = {
  ...standardCatalog,
  components: {
    ...standardCatalog.components,
    Text: TextAdapter,
    Button: ButtonAdapter,
    Card: CardAdapter,
    TextField: InputAdapter,
    Image: ImageAdapter,
    Row: RowAdapter,
    Column: ColumnAdapter,
    List: ListAdapter,
    Divider: DividerAdapter,
    CodeBlock: CodeBlockAdapter,
    CheckBox: CheckBoxAdapter,
    MultipleChoice: MultipleChoiceAdapter,
    Slider: SliderAdapter,
    DateTimeInput: DateTimeInputAdapter,
    Icon: IconAdapter,
    Video: VideoAdapter,
    AudioPlayer: AudioPlayerAdapter,
    Tabs: TabsAdapter,
    Modal: ModalAdapter,
  },
}

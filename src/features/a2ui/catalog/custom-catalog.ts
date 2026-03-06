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
  },
}

import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"

componentRegistry.setOptionOverrides("explorer", {
  sortFn: (a: any, b: any) => {
    // 폴더 순서
    const folderOrder: Record<string, number> = {
      "Execution Model": 1,
      "Networking": 2,
      "Game World": 3,
      "State Synchronization": 4,
      "Physics": 5,
      "Client Integration": 6,
      "Data Pipeline": 7,
      "Observability": 8,
    }

    if (a.isFolder && b.isFolder) {
      const ao = folderOrder[a.displayName ?? ""]
      const bo = folderOrder[b.displayName ?? ""]

      if (ao !== undefined || bo !== undefined) {
        return (ao ?? 999) - (bo ?? 999)
      }
    }

    // 폴더 우선
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1
    }

    // 문서는 실제 filename/slug의 01-, 02- 기준
    return (a.slugSegment ?? "").localeCompare(
      b.slugSegment ?? "",
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    )
  },
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()

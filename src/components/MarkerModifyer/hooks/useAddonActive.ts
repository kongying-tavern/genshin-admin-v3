export const useAddonActive = (addonId: Ref<string | undefined>, id: string) => {
  const isActive = computed({
    get: () => toValue(addonId) === id,
    set: bool => {
      addonId.value = bool ? id : ''
    },
  })

  return isActive
}

import { Share } from '@capacitor/share';

interface ShareOptions {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
}

export const nativeShare = async (options: ShareOptions): Promise<boolean> => {
    try {
        const canShare = await Share.canShare();

        if (canShare.value) {
            await Share.share({
                title: options.title,
                text: options.text,
                url: options.url,
                dialogTitle: options.dialogTitle,
            });
            return true;
        }

        // Fallback for web environment where navigator.share might be available
        if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({
                title: options.title,
                text: options.text,
                url: options.url,
            });
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error in nativeShare:', error);
        return false;
    }
};

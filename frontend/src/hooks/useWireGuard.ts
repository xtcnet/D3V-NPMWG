import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	getWgClients,
	getWgInterface,
	createWgClient,
	deleteWgClient,
	enableWgClient,
	disableWgClient,
	type WgClient,
	type WgInterface,
} from "src/api/backend/wireguard";

export const useWgClients = (options = {}) => {
	return useQuery<WgClient[], Error>({
		queryKey: ["wg-clients"],
		queryFn: getWgClients,
		refetchInterval: 5000,
		staleTime: 3000,
		...options,
	});
};

export const useWgInterface = (options = {}) => {
	return useQuery<WgInterface, Error>({
		queryKey: ["wg-interface"],
		queryFn: getWgInterface,
		staleTime: 60 * 1000,
		...options,
	});
};

export const useCreateWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: { name: string }) => createWgClient(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};

export const useDeleteWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => deleteWgClient(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};

export const useToggleWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
			enabled ? enableWgClient(id) : disableWgClient(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};
